import express from 'express';
import {
    addReview,
    getUserReviews,
    moderateReview,
    reportReview,
    getAllReviews
} from '../controllers/reviewController.js';
import { auth } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - get reviews for a user
router.get("/user/:userId", getUserReviews);

// Protected routes
router.post("/", auth, addReview);
router.post("/:reviewId/report", auth, reportReview);

// Admin routes
router.get("/admin/all", auth, authorize('admin'), getAllReviews);
router.put("/admin/:reviewId/moderate", auth, authorize('admin'), moderateReview);

export default router;

