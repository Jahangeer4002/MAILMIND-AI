import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { summarizeEmail, summarizeThread } from '../../services/gemini.service.js';
import { EmailRepository, SummaryRepository } from '../../repositories/index.js';
import { stripHtml } from '../../utils/helpers.js';

const router = Router();
const emailRepo = new EmailRepository();
const summaryRepo = new SummaryRepository();

router.get(
  '/emails/:id/summary',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await summaryRepo.getEmailSummary(String(req.params.id));
    if (existing) {
      res.json({ success: true, summary: existing });
      return;
    }

    const email = await emailRepo.findById(String(req.params.id));
    if (!email) throw new AppError(404, 'Email not found');

    const body = email.body_text || stripHtml(email.body_html ?? '');
    const result = await summarizeEmail(
      email.subject ?? '',
      body,
      email.from_name || email.from_email || ''
    );

    await summaryRepo.upsertEmailSummary(
      email.id,
      result.summary,
      result.actionItems,
      result.keyPoints
    );

    res.json({ success: true, summary: result });
  })
);

router.get(
  '/threads/:id/summary',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await summaryRepo.getThreadSummary(String(req.params.id));
    if (existing) {
      res.json({ success: true, summary: existing });
      return;
    }

    const thread = await emailRepo.findThreadById(String(req.params.id));
    if (!thread) throw new AppError(404, 'Thread not found');

    const messages = (thread.emails ?? []).map(
      (e: { from_name: string; from_email: string; received_at: string; body_text: string; body_html: string }) => ({
        from: e.from_name || e.from_email || 'Unknown',
        date: e.received_at ?? '',
        body: e.body_text || stripHtml(e.body_html ?? ''),
      })
    );

    const result = await summarizeThread(thread.subject ?? '', messages);
    await summaryRepo.upsertThreadSummary(
      thread.id,
      result.summary,
      result.actionItems,
      result.keyDecisions
    );

    res.json({ success: true, summary: result });
  })
);

export default router;
