import { Router } from 'express';
import { create, get, list, uploadPdf } from '../Controllers/paperController.js';
import { requireAuth } from '../Middleware/authMiddleware.js';
import { pdfUpload } from '../Middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth);
router.route('/').get(list).post(create);
router.post('/upload', pdfUpload.single('file'), uploadPdf);
router.get('/:id', get);
export default router;
