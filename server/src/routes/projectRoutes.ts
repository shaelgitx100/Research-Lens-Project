import { Router } from 'express';
import { createProject, deleteProject, getProject, listProjects } from '../Controllers/projectController.js';
import { requireAuth } from '../Middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.route('/').get(listProjects).post(createProject);
router.route('/:id').get(getProject).delete(deleteProject);
export default router;
