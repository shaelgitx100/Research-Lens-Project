import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodType, part: RequestPart = 'body'): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[part]);
    if (!parsed.success) return next(parsed.error);
    Object.assign(req, { [part]: parsed.data });
    next();
  };
}
