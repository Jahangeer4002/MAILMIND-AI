import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { runGmailSync, getSyncStatus } from '../../services/sync.service.js';

const router = Router();

router.post(
  '/sync',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await runGmailSync(req.user!.userId);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getSyncStatus(req.user!.userId);
    res.json({ success: true, ...status });
  })
);

export default router;
