import { Router } from 'express';
import { create, list } from '../Controllers/researchQuestionController.js';
import { requireAuth } from '../Middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.route('/').get(list).post(create);
export default router;
