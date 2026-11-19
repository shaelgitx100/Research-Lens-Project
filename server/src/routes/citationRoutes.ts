import { Router } from 'express';
import { create, explore, list, network, resolveMissingMetadata, verifyMetadataMatch } from '../Controllers/citationController.js';
import { requireAuth } from '../Middleware/authMiddleware.js';
import { attachWorkspace } from '../Services/workspaceService.js';

const router = Router();
router.use(requireAuth, attachWorkspace);
router.post('/resolve-metadata', resolveMissingMetadata);
router.post('/network/:paperId/verify-match', verifyMetadataMatch);
router.get('/network', network);
router.get('/network/:paperId/explore', explore);
router.route('/').get(list).post(create);
export default router;
