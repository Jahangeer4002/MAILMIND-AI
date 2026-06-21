import { Router, Request, Response } from "express";
import { env } from "../../config/env.js";
import { asyncHandler, AppError } from "../../middleware/errorHandler.js";
import { authMiddleware, signToken } from "../../middleware/auth.js";
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getUserProfile,
} from "../../services/gmail.service.js";
import {
  UserRepository,
  GmailAccountRepository,
} from "../../repositories/index.js";

const router = Router();
const userRepo = new UserRepository();
const gmailAccountRepo = new GmailAccountRepository();

router.get(
  "/google",
  asyncHandler(async (_req: Request, res: Response) => {
    const url = getAuthUrl();
    res.json({ success: true, url });
  }),
);

router.get(
  "/google/callback",
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) throw new AppError(400, "Authorization code missing");

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token)
      throw new AppError(400, "Failed to obtain access token");

    const profile = await getUserProfile(tokens.access_token);
    if (!profile.email || !profile.id)
      throw new AppError(400, "Failed to get user profile");

    const user = await userRepo.upsert({
      google_id: profile.id,
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    });

    await gmailAccountRepo.upsert({
      user_id: user.id,
      email: profile.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    });

    const token = signToken({ userId: user.id, email: user.email });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.CLIENT_URL}/dashboard`);
  }),
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userRepo.findById(req.user!.userId);
    if (!user) throw new AppError(404, "User not found");

    const account = await gmailAccountRepo.findByUserId(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        gmailConnected: !!account,
      },
    });
  }),
);

router.post(
  "/logout",
  asyncHandler(async (_req: Request, res: Response) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    res.json({ success: true, message: "Logged out" });
  }),
);

export default router;
