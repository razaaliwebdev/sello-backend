import express from 'express';
import { uploadFile } from '../controllers/uploadController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protected route - any authenticated user can upload (or restrict to admin if needed)
router.post("/", auth, upload.single('file'), uploadFile);

export default router;
