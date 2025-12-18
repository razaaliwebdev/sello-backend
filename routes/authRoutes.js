import express from 'express';
import {
    register,
    login,
    forgotPassword,
    verifyOtp,
    resetPassword,
    googleLogin,
    logout,
    refreshToken,
    sendPhoneVerification,
    verifyPhone
} from '../controllers/authController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public Authentication Routes
// Use fields for dealer registration (avatar + cnicFile)
router.post("/register", upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cnicFile', maxCount: 1 }
]), register);
router.post("/login", login);
router.post("/refresh-token", refreshToken); // Refresh token endpoint
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/google", googleLogin);
router.post("/logout", logout); // Can be used with or without auth

// Protected Phone Verification Routes
router.post("/phone/send-code", auth, sendPhoneVerification);
router.post("/phone/verify", auth, verifyPhone);

export default router;

