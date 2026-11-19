import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isDatabaseConnected } from '../../Config/db.js';
import { requireAuth } from '../../Middleware/authMiddleware.js';
import { attachWorkspace } from '../../Services/workspaceService.js';
import { analyzePaperController, listAiFeatureResultsController, runAiFeatureController } from '../Controllers/ai.controller.js';

const router = Router();
const requireDatabase = (_req: Request, res: Response, next: NextFunction) => {
  if (isDatabaseConnected()) return next();
  return res.status(503).json({ error: 'MongoDB is not configured or unavailable.' });
};

export const userAiLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || 'unknown',
  message: { error: 'Analysis limit reached. Please wait a minute before trying again.' },
});

router.post('/papers/:paperId/analyze', requireAuth, requireDatabase, attachWorkspace, userAiLimit, analyzePaperController);
router.post('/features/:feature', requireAuth, requireDatabase, attachWorkspace, userAiLimit, runAiFeatureController);
router.get('/features/:feature', requireAuth, requireDatabase, attachWorkspace, listAiFeatureResultsController);

export default router;
