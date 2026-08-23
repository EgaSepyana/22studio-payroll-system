import { Router } from 'express';
import multer from 'multer';
import * as uploadController from '../controllers/uploadController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

// Order design uploads are a Produksi action; the CMS image upload is
// landing-page content management and stays admin-only.
router.post('/design', requireRole('admin', 'admin_produksi', 'owner'), upload.single('file'), uploadController.uploadDesign);
router.post('/cms-image', requireRole('admin', 'owner'), upload.single('file'), uploadController.uploadCmsImage);

export default router;
