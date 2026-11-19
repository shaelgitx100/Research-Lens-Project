import { Router } from 'express';
import { generate, get, list } from '../Controllers/reportController.js';
import { requireAuth } from '../Middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', list);
router.post('/generate', generate);
router.get('/:id', get);
export default router;
