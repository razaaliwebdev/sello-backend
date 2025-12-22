import express from 'express';
import {
    getSubscriptionPlans,
    getMySubscription,
    purchaseSubscription,
    cancelSubscription,
    getPaymentHistory
} from '../controllers/subscriptionController.js';
import {
    createSubscriptionCheckout,
    createBoostCheckout,
    stripeWebhook,
    jazzcashWebhook,
    verifyPaymentSession
} from '../controllers/paymentController.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - get available plans
router.get("/plans", getSubscriptionPlans);

// Payment webhooks (must be before auth middleware)
// Stripe webhook (uses raw body)
router.post("/webhook/stripe", express.raw({ type: 'application/json' }), stripeWebhook);
// JazzCash webhook/callback (uses form data)
router.post("/webhook/jazzcash", express.urlencoded({ extended: true }), jazzcashWebhook);
// Generic webhook route for backward compatibility (defaults to Stripe)
router.post("/webhook", express.raw({ type: 'application/json' }), stripeWebhook);

// Protected routes
router.use(auth);

router.get("/my-subscription", getMySubscription);
router.post("/purchase", purchaseSubscription);
router.post("/cancel", cancelSubscription);
router.get("/payment-history", getPaymentHistory);

// Stripe checkout routes
router.post("/checkout", createSubscriptionCheckout);
router.post("/boost-checkout", createBoostCheckout);
router.get("/verify-payment/:sessionId", verifyPaymentSession);

export default router;

