import express from 'express';
import {
    getSubscriptionPlans,
    getMySubscription,
    purchaseSubscription,
    cancelSubscription,
    getPaymentHistory
} from '../controllers/subscriptionController.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - get available plans
router.get("/plans", getSubscriptionPlans);

// Protected routes
router.use(auth);

router.get("/my-subscription", getMySubscription);
router.post("/purchase", purchaseSubscription);
router.post("/cancel", cancelSubscription);
router.get("/payment-history", getPaymentHistory);

export default router;

