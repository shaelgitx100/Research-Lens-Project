import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../Utils/AppError';
import { env } from '../Config/env';
import { logger } from '../Utils/logger';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'Route not found'));
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${env.maxUploadMb} MB` : 'Upload error';
    return res.status(400).json({ error: msg });
  }
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier' });
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: Object.values(err.errors || {}).map((e: any) => e.message) });
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'Duplicate record' });
  logger.error(`${req.method} ${req.path}`, env.nodeEnv === 'production' ? err?.message : err);
  res.status(500).json({ error: 'Internal server error' });
}
