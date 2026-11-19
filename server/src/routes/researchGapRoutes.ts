import { Router } from 'express';
import { create, list } from '../Controllers/researchGapController.js';
import { requireAuth } from '../Middleware/authMiddleware.js';
import { attachWorkspace } from '../Services/workspaceService.js';

const router = Router();
router.use(requireAuth, attachWorkspace);
router.route('/').get(list).post(create);
export default router;
