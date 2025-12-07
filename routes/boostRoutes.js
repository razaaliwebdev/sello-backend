import express from 'express';
import {
    boostPost,
    adminPromotePost,
    adminBoostPost,
    removeBoost,
    getBoostStatus,
    purchaseCredits,
    getBoostPricing,
    getBoostOptions
} from '../controllers/boostController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route
router.get("/pricing", getBoostPricing);

// All other routes require authentication
router.use(auth);

// User routes
router.post("/:carId", boostPost);
router.get("/:carId/status", getBoostStatus);
router.get("/options", getBoostOptions);
router.post("/credits/purchase", purchaseCredits);

// Admin routes
router.post("/:carId/admin", authorize('admin'), adminBoostPost);
router.post("/:carId/admin-promote", authorize('admin'), adminPromotePost);
router.delete("/:carId", authorize('admin'), removeBoost);

export default router;

