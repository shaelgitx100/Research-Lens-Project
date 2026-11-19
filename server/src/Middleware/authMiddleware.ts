import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../Config/env.js';
import type {} from '../Types/express.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !env.jwtSecret || env.jwtSecret.length < 32) {
    res.status(401).json({ success: false, message: 'Authentication required.', error: { code: 'AUTH_REQUIRED' } });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token subject.');
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Authentication required.', error: { code: 'AUTH_REQUIRED' } });
  }
}
