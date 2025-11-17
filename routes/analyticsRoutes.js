import express from 'express';
import { getAnalytics } from '../controllers/analyticsController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

router.get("/", getAnalytics);

export default router;

