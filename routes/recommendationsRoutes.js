import express from 'express';
import {
    getSimilarListings,
    trackRecentlyViewed,
    getRecentlyViewed,
    getRecommendedListings
} from '../controllers/recommendationsController.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get("/similar/:carId", getSimilarListings);

// Protected routes
router.post("/viewed/:carId", auth, trackRecentlyViewed);
router.get("/viewed", auth, getRecentlyViewed);
router.get("/recommended", auth, getRecommendedListings);

export default router;

