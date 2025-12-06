import express from 'express';
import {
    register,
    login,
    forgotPassword,
    verifyOtp,
    resetPassword,
    googleLogin,
    logout
} from '../controllers/authController.js';
import { upload } from '../middlewares/multer.js';

const router = express.Router();

// Public Authentication Routes
// Use fields for dealer registration (avatar + cnicFile)
router.post("/register", upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cnicFile', maxCount: 1 }
]), register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/google", googleLogin);
router.post("/logout", logout);

export default router;

