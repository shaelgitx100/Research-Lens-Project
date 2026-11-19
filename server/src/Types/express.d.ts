import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
      authenticatedUserId?: Types.ObjectId;
    }
  }
}

export {};
