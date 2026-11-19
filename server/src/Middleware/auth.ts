import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../Config/env';
import { User } from '../Models/User';
import { AppError } from '../Utils/AppError';
import { logger } from '../Utils/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
    }
  }
}

export const COOKIE_NAME = 'rl_token';

function expirationSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+)\s*(s|sec(?:ond)?s?|m|min(?:ute)?s?|h|hours?|d|days?|w|weeks?|y|years?)?$/i.exec(value.trim());
  if (!match) throw new AppError(500, 'JWT_EXPIRES_IN must be a positive duration');
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase()[0];
  const multiplier = unit === 's' ? 1
    : unit === 'm' ? 60
      : unit === 'h' ? 3600
        : unit === 'd' ? 86400
          : unit === 'w' ? 604800
            : unit === 'y' ? 31536000
              : 1;
  const seconds = amount * multiplier;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new AppError(500, 'JWT_EXPIRES_IN must be a positive duration');
  return seconds;
}

export function signToken(userId: string): string {
  if (!env.jwtSecret) throw new AppError(500, 'JWT_SECRET is not configured');
  const expiresIn = expirationSeconds(env.jwtExpiresIn);
  return jwt.sign({ sub: userId }, env.jwtSecret, expiresIn === undefined ? {} : { expiresIn });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const token = req.cookies?.[COOKIE_NAME] || bearer;
    if (!token) throw new AppError(401, 'Authentication required');
    let payload: jwt.JwtPayload;
    try {
      if (!env.jwtSecret) throw new AppError(500, 'JWT_SECRET is not configured');
      const verified = jwt.verify(token, env.jwtSecret);
      if (typeof verified === 'string' || typeof verified.sub !== 'string') throw new Error('Invalid token subject');
      payload = verified;
    } catch {
      logger.security('invalidToken', { ip: req.ip });
      throw new AppError(401, 'Session expired or invalid');
    }
    const user = await User.findById(payload.sub).select('role email').lean();
    if (!user) throw new AppError(401, 'Account not found');
    req.user = { id: String(user._id), role: user.role, email: user.email };
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.security('forbidden', { userId: req.user?.id, path: req.path });
      return next(new AppError(403, 'Forbidden'));
    }
    next();
  };
