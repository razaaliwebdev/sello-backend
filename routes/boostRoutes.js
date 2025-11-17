import express from 'express';
import {
    boostPost,
    adminBoostPost,
    removeBoost,
    getBoostStatus,
    purchaseCredits,
    getBoostPricing
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
router.delete("/:carId", removeBoost);
router.post("/credits/purchase", purchaseCredits);

// Admin routes
router.post("/:carId/admin", authorize('admin'), adminBoostPost);

export default router;

