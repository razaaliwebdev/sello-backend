import express from "express";
import {
  createDeletionRequest,
  getDeletionRequestStatus,
  getAllDeletionRequests,
  reviewDeletionRequest,
  getDeletionRequestStats,
} from "../controllers/accountDeletionController.js";
import { auth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(auth);

// User routes
router.post("/request-deletion", createDeletionRequest);
router.get("/deletion-request-status", getDeletionRequestStatus);

// Admin routes
router.get("/admin/deletion-requests", getAllDeletionRequests);
router.get("/admin/deletion-request-stats", getDeletionRequestStats);
router.put("/admin/deletion-requests/:requestId/review", reviewDeletionRequest);

export default router;
