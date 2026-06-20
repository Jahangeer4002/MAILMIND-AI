import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { processChatMessage } from '../../services/rag.service.js';
import { ChatRepository } from '../../repositories/index.js';

const router = Router();
const chatRepo = new ChatRepository();

const chatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});

router.post(
  '/',
  authMiddleware,
  validateBody(chatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { message, sessionId } = req.body as z.infer<typeof chatSchema>;
    const result = await processChatMessage(req.user!.userId, message, sessionId);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/sessions',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessions = await chatRepo.getUserSessions(req.user!.userId);
    res.json({ success: true, sessions });
  })
);

router.get(
  '/sessions/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const session = await chatRepo.getSession(String(req.params.id));
    res.json({ success: true, session });
  })
);

export default router;
