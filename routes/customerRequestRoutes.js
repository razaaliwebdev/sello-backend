import express from 'express';
import {
    getAllCustomerRequests,
    getCustomerRequestById,
    createCustomerRequest,
    updateCustomerRequest,
    addResponse,
    deleteCustomerRequest,
    getCustomerRequestStatistics
} from '../controllers/customerRequestController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - users can create requests
router.post("/", auth, createCustomerRequest);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.get("/statistics", getCustomerRequestStatistics);
router.get("/", getAllCustomerRequests);
router.get("/:requestId", getCustomerRequestById);
router.put("/:requestId", updateCustomerRequest);
router.post("/:requestId/response", addResponse);
router.delete("/:requestId", deleteCustomerRequest);

export default router;

