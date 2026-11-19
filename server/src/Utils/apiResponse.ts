import type { Response } from 'express';

export function success<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function failure(res: Response, message: string, status = 400, details?: unknown) {
  return res.status(status).json({ success: false, error: message, ...(details === undefined ? {} : { details }) });
}
