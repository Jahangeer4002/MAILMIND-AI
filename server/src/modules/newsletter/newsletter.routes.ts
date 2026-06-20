import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { generateNewsDigest } from '../../services/newsletter.service.js';

const router = Router();

router.get(
  '/digest',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const digest = await generateNewsDigest(req.user!.userId, days);
    res.json({ success: true, digest });
  })
);

export default router;
