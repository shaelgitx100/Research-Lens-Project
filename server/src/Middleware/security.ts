import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../Config/env';
import { COOKIE_NAME } from './auth';
import { AppError } from '../Utils/AppError';
import { logger } from '../Utils/logger';

function strip(obj: any): any {
  if (Array.isArray(obj)) return obj.map(strip);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = strip(v);
    }
    return out;
  }
  return obj;
}

/** Removes Mongo operator style keys from request bodies. */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = strip(req.body);
  next();
}

/** Cookie authenticated state changing requests must come from the configured client origin. */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (mutating && req.cookies?.[COOKIE_NAME]) {
    const origin = req.headers.origin;
    if (!origin || !env.corsOrigins?.includes(origin)) {
      logger.security('originRejected', { origin, path: req.path });
      return next(new AppError(403, 'Origin not allowed'));
    }
  }
  next();
}

export const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false });
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
export const heavyLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
