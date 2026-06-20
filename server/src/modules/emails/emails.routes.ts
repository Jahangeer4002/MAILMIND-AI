import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError, validateQuery } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { GmailAccountRepository, EmailRepository } from '../../repositories/index.js';

const router = Router();
const gmailAccountRepo = new GmailAccountRepository();
const emailRepo = new EmailRepository();

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  unread: z.coerce.boolean().optional(),
});

router.get(
  '/',
  authMiddleware,
  validateQuery(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const account = await gmailAccountRepo.findByUserId(req.user!.userId);
    if (!account) throw new AppError(400, 'Gmail not connected');

    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const result = await emailRepo.findEmails(account.id, query);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const email = await emailRepo.findById(String(req.params.id));
    if (!email) throw new AppError(404, 'Email not found');
    res.json({ success: true, email });
  })
);

router.get(
  '/threads/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const thread = await emailRepo.findThreadById(String(req.params.id));
    if (!thread) throw new AppError(404, 'Thread not found');
    res.json({ success: true, thread });
  })
);

export default router;
