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
    verifyPhone,
    logoutAllDevices
} from '../controllers/authController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';
import { authLimiter, passwordResetLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public Authentication Routes with rate limiting
// Use fields for dealer registration (avatar + cnicFile)
router.post("/register", authLimiter, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cnicFile', maxCount: 1 }
]), register);
router.post("/login", authLimiter, login);
router.post("/refresh-token", authLimiter, refreshToken); // Refresh token endpoint
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/verify-otp", passwordResetLimiter, verifyOtp);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.post("/google", authLimiter, googleLogin);
router.post("/logout", logout); // Can be used with or without auth

// Protected Routes
router.post("/logout-all", auth, logoutAllDevices); // Logout from all devices
router.post("/phone/send-code", auth, sendPhoneVerification);
router.post("/phone/verify", auth, verifyPhone);

export default router;
