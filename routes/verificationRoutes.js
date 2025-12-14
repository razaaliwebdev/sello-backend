import express from 'express';
import { auth } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/multer.js';
import {
    submitVerification,
    reviewVerification,
    getVerificationStatus,
    getAllVerifications
} from '../controllers/verificationController.js';

const router = express.Router();

// User routes
router.post('/', auth, upload.fields([
    { name: 'frontDocument', maxCount: 1 },
    { name: 'backDocument', maxCount: 1 }
]), submitVerification);

router.get('/status', auth, getVerificationStatus);

// Admin routes
router.get('/all', auth, getAllVerifications);
router.put('/:verificationId/review', auth, reviewVerification);

export default router;
