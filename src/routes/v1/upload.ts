import { Router } from 'express';
import { uploadImage } from '../../controllers/upload.controller.js';

const router = Router();
router.post('/upload', uploadImage);
export default router;
