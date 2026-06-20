import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { GmailAccountRepository, CategoryRepository } from '../../repositories/index.js';
import { EMAIL_CATEGORIES } from '../../config/env.js';

const router = Router();
const gmailAccountRepo = new GmailAccountRepository();
const categoryRepo = new CategoryRepository();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const account = await gmailAccountRepo.findByUserId(req.user!.userId);
    const counts = account ? await categoryRepo.getCategoryCounts(account.id) : {};

    res.json({
      success: true,
      categories: EMAIL_CATEGORIES.map((cat) => ({
        name: cat,
        count: counts[cat] ?? 0,
      })),
    });
  })
);

export default router;
