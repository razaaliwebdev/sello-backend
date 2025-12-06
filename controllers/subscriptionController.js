import User from '../models/userModel.js';
import Logger from '../utils/logger.js';

// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS = {
    free: {
        name: "Free",
        price: 0,
        duration: 0, // days
        features: [
            "Basic listing",
            "5 active listings",
            "Standard support"
        ],
        maxListings: 5,
        boostCredits: 0
    },
    basic: {
        name: "Basic",
        price: 29.99,
        duration: 30, // days
        features: [
            "Unlimited listings",
            "Priority support",
            "5 boost credits/month",
            "Featured listing badge"
        ],
        maxListings: -1, // unlimited
        boostCredits: 5
    },
    premium: {
        name: "Premium",
        price: 59.99,
        duration: 30, // days
        features: [
            "Unlimited listings",
            "Priority support",
            "20 boost credits/month",
            "Featured listing badge",
            "Analytics dashboard",
            "Advanced search filters"
        ],
        maxListings: -1,
        boostCredits: 20
    },
    dealer: {
        name: "Dealer",
        price: 149.99,
        duration: 30, // days
        features: [
            "Unlimited listings",
            "24/7 priority support",
            "50 boost credits/month",
            "Featured listing badge",
            "Analytics dashboard",
            "Advanced search filters",
            "Dealer verification badge",
            "Bulk listing tools"
        ],
        maxListings: -1,
        boostCredits: 50
    }
};

/**
 * Get Available Subscription Plans
 */
export const getSubscriptionPlans = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: SUBSCRIPTION_PLANS
        });
    } catch (error) {
        Logger.error("Get Subscription Plans Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching subscription plans"
        });
    }
};

/**
 * Get User's Current Subscription
 */
export const getMySubscription = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('subscription boostCredits');
        
        return res.status(200).json({
            success: true,
            data: {
                subscription: user.subscription,
                boostCredits: user.boostCredits,
                planDetails: SUBSCRIPTION_PLANS[user.subscription.plan] || SUBSCRIPTION_PLANS.free
            }
        });
    } catch (error) {
        Logger.error("Get My Subscription Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching subscription"
        });
    }
};

/**
 * Purchase/Upgrade Subscription
 */
export const purchaseSubscription = async (req, res) => {
    try {
        const { plan, paymentMethod, transactionId, autoRenew } = req.body;

        if (!plan || !SUBSCRIPTION_PLANS[plan]) {
            return res.status(400).json({
                success: false,
                message: "Invalid subscription plan"
            });
        }

        const selectedPlan = SUBSCRIPTION_PLANS[plan];
        const user = await User.findById(req.user._id);

        // Check if user already has an active subscription
        if (user.subscription.isActive && user.subscription.plan === plan) {
            return res.status(400).json({
                success: false,
                message: `You already have an active ${plan} subscription`
            });
        }

        // Calculate end date
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + selectedPlan.duration);

        // Update subscription
        user.subscription = {
            plan: plan,
            startDate: startDate,
            endDate: endDate,
            isActive: true,
            autoRenew: autoRenew === true
        };

        // Add boost credits if included in plan
        if (selectedPlan.boostCredits > 0) {
            user.boostCredits += selectedPlan.boostCredits;
        }

        // Add to payment history
        user.paymentHistory.push({
            amount: selectedPlan.price,
            currency: "USD",
            paymentMethod: paymentMethod || "card",
            transactionId: transactionId || `TXN-${Date.now()}`,
            purpose: "subscription",
            status: "completed",
            createdAt: new Date()
        });

        user.totalSpent += selectedPlan.price;

        await user.save({ validateBeforeSave: false });

        Logger.info(`User ${user._id} purchased ${plan} subscription`);

        return res.status(200).json({
            success: true,
            message: `Successfully subscribed to ${selectedPlan.name} plan`,
            data: {
                subscription: user.subscription,
                boostCredits: user.boostCredits,
                planDetails: selectedPlan
            }
        });
    } catch (error) {
        Logger.error("Purchase Subscription Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error processing subscription",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Cancel Subscription
 */
export const cancelSubscription = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.subscription.isActive) {
            return res.status(400).json({
                success: false,
                message: "You don't have an active subscription"
            });
        }

        // Disable auto-renewal
        user.subscription.autoRenew = false;
        // Keep subscription active until end date
        // Don't set isActive to false - let expiration job handle it

        await user.save({ validateBeforeSave: false });

        Logger.info(`User ${user._id} cancelled subscription auto-renewal`);

        return res.status(200).json({
            success: true,
            message: "Subscription auto-renewal cancelled. Your subscription will remain active until the end date.",
            data: {
                subscription: user.subscription
            }
        });
    } catch (error) {
        Logger.error("Cancel Subscription Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error cancelling subscription"
        });
    }
};

/**
 * Get Payment History
 */
export const getPaymentHistory = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('paymentHistory totalSpent');
        
        return res.status(200).json({
            success: true,
            data: {
                payments: user.paymentHistory || [],
                totalSpent: user.totalSpent || 0
            }
        });
    } catch (error) {
        Logger.error("Get Payment History Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching payment history"
        });
    }
};

