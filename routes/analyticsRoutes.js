import express from 'express';
import { getAnalyticsSummary, trackAnalyticsEvent } from '../controllers/analyticsController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Admin routes
router.get("/summary", auth, authorize('admin'), getAnalyticsSummary);

// Track event (authenticated users)
router.post("/track", auth, trackAnalyticsEvent);

export default router;

