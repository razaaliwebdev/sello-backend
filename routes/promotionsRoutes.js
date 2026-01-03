import express from "express";
import {
  createPromotion,
  getAllPromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  getPromotionStats,
  validatePromoCode,
  getActivePromotions,
} from "../controllers/promotionsController.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import { hasPermission } from "../middlewares/permissionMiddleware.js";

const router = express.Router();

// Public routes
router.post("/validate", validatePromoCode);
router.get("/active", getActivePromotions);

// All other routes require admin access with permission checks
router.use(auth);
router.use(authorize("admin"));

router.post("/", hasPermission("createPromotions"), createPromotion);
router.get("/", hasPermission("viewPromotions"), getAllPromotions);
router.get("/statistics", hasPermission("viewPromotions"), getPromotionStats);
router.get("/:promotionId", hasPermission("viewPromotions"), getPromotionById);
router.put("/:promotionId", hasPermission("editPromotions"), updatePromotion);
router.delete(
  "/:promotionId",
  hasPermission("deletePromotions"),
  deletePromotion
);

export default router;
