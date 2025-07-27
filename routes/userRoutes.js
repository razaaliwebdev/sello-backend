import express from 'express';
import passport from "passport";
import { forgotPassword, getUserProfile, googleLogin, login, logoutController, register, resetPassword, verifyOtp } from '../controllers/userController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();


// Public Routes
router.post("/register", upload.single("avatar"), register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/google", googleLogin);


// Protected Routes
router.get("/me", auth, getUserProfile);
router.post("/logout", logoutController);


export default router;