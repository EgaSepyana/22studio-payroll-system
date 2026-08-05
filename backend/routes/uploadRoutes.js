import { Router } from 'express';
import multer from 'multer';
import * as uploadController from '../controllers/uploadController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

router.post('/design', upload.single('file'), uploadController.uploadDesign);
router.post('/cms-image', upload.single('file'), uploadController.uploadCmsImage);

export default router;
