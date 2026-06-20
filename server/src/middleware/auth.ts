import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { JwtPayload } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (token) {
    try {
      req.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}
