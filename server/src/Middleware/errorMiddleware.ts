import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input.', details: error.flatten() });
    return;
  }
  if (error?.name === 'CastError') {
    res.status(400).json({ error: 'Invalid identifier.' });
    return;
  }
  if (error?.name === 'MulterError') {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message || 'Upload could not be processed.' });
    return;
  }
  if ((typeof error?.status === 'number' && error.status >= 400 && error.status < 500) || error?.status === 502 || error?.status === 503) {
    res.status(error.status).json({ error: error.message || 'Request could not be completed.' });
    return;
  }
  console.error('Request failed:', error?.message || error);
  res.status(500).json({ error: 'Request failed. Please try again.' });
};
