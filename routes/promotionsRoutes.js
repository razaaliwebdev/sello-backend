import express from 'express';
import {
    getAllPromotions,
    getPromotionStats
} from '../controllers/promotionsController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

router.get("/", getAllPromotions);
router.get("/statistics", getPromotionStats);

export default router;

