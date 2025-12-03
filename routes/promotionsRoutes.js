import express from 'express';
import {
    createPromotion,
    getAllPromotions,
    getPromotionById,
    updatePromotion,
    deletePromotion,
    getPromotionStats,
    validatePromoCode
} from '../controllers/promotionsController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route for validating promo codes
router.post("/validate", validatePromoCode);

// All other routes require admin access
router.use(auth);
router.use(authorize('admin'));

router.post("/", createPromotion);
router.get("/", getAllPromotions);
router.get("/statistics", getPromotionStats);
router.get("/:promotionId", getPromotionById);
router.put("/:promotionId", updatePromotion);
router.delete("/:promotionId", deletePromotion);

export default router;

