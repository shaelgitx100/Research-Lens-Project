import { NextFunction, Request, Response } from 'express';
import { z, ZodTypeAny } from 'zod';
import { Types } from 'mongoose';

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v) && String(new Types.ObjectId(v)) === v, 'Invalid id');

/** Validates and replaces body, query and params with parsed (stripped) values. */
export const validate =
  (schemas: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      if (schemas.query) (req as any).validatedQuery = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (e) {
      next(e);
    }
  };

export const idParam = z.object({ id: objectId });
export const q = (req: Request) => (req as any).validatedQuery ?? req.query;
