import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError, validateBody } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { composeEmail, draftReply } from '../../services/gemini.service.js';
import { getGmailClient, sendEmail } from '../../services/gmail.service.js';
import { GmailAccountRepository, EmailRepository } from '../../repositories/index.js';
import { stripHtml } from '../../utils/helpers.js';

const router = Router();
const gmailAccountRepo = new GmailAccountRepository();
const emailRepo = new EmailRepository();

const composeSchema = z.object({
  prompt: z.string().min(5),
  to: z.string().email().optional(),
  send: z.boolean().default(false),
});

const replySchema = z.object({
  emailId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  instruction: z.string().min(3),
  send: z.boolean().default(false),
  to: z.string().email().optional(),
});

router.post(
  '/compose',
  authMiddleware,
  validateBody(composeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, to, send } = req.body as z.infer<typeof composeSchema>;
    const draft = await composeEmail(prompt);

    if (send && to) {
      const account = await gmailAccountRepo.findByUserId(req.user!.userId);
      if (!account) throw new AppError(400, 'Gmail not connected');

      const gmail = getGmailClient(account);
      const fullBody = `${draft.body}\n\n${draft.closing}`;
      await sendEmail(gmail, to, draft.subject, fullBody);

      res.json({ success: true, draft, sent: true });
      return;
    }

    res.json({ success: true, draft, sent: false });
  })
);

router.post(
  '/reply',
  authMiddleware,
  validateBody(replySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { emailId, threadId, instruction, send, to } = req.body as z.infer<typeof replySchema>;

    let thread;
    if (threadId) {
      thread = await emailRepo.findThreadById(threadId);
    } else if (emailId) {
      const email = await emailRepo.findById(emailId);
      if (email?.thread_id) {
        thread = await emailRepo.findThreadById(email.thread_id);
      }
    }

    if (!thread) throw new AppError(404, 'Thread not found');

    const messages = (thread.emails ?? []).map(
      (e: { from_name: string; from_email: string; body_text: string; body_html: string }) => ({
        from: e.from_name || e.from_email || 'Unknown',
        body: e.body_text || stripHtml(e.body_html ?? ''),
      })
    );

    const draft = await draftReply(thread.subject ?? '', messages, instruction);

    if (send) {
      const account = await gmailAccountRepo.findByUserId(req.user!.userId);
      if (!account) throw new AppError(400, 'Gmail not connected');

      const lastEmail = (thread.emails ?? []).slice(-1)[0];
      const recipient = to || lastEmail?.from_email;
      if (!recipient) throw new AppError(400, 'Recipient not found');

      const gmail = getGmailClient(account);
      await sendEmail(
        gmail,
        recipient,
        draft.subject,
        draft.body,
        thread.gmail_thread_id,
        lastEmail?.headers?.['Message-ID'] as string | undefined,
        lastEmail?.references_header ?? undefined
      );

      res.json({ success: true, draft, sent: true });
      return;
    }

    res.json({ success: true, draft, sent: false });
  })
);

export default router;
