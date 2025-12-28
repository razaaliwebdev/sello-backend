import User from '../models/userModel.js';
import Logger from '../utils/logger.js';
import SubscriptionPlan from '../models/subscriptionPlanModel.js';
import Settings from '../models/settingsModel.js';

// Legacy hardcoded plans (fallback)
// NOTE: We set `free` to unlimited listings for the initial phase.
// In production with real paid plans, you can change `maxListings` for `free`
// back to a limited number (e.g. 5 or 10) if you want to enforce limits.
const LEGACY_PLANS = {
    free: {
        name: "Free",
        price: 0,
        duration: 0, // days (lifetime / no expiry)
        features: [
            "Unlimited listings",
            "Standard support"
        ],
        // -1 means unlimited listings (initial phase: everything is free)
        maxListings: -1,
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

// Export for backward compatibility
export const SUBSCRIPTION_PLANS = LEGACY_PLANS;

/**
 * Get Available Subscription Plans
 */
export const getSubscriptionPlans = async (req, res) => {
    try {
        // Check if payment system is enabled
        const paymentEnabled = await Settings.findOne({ key: 'paymentSystemEnabled' });
        // Default to true if setting doesn't exist
        const isPaymentEnabled = paymentEnabled === null ? true : (paymentEnabled.value !== false && paymentEnabled.value !== 'false');
        
        // Check if subscription tab should be shown (only check once)
        const showTab = await Settings.findOne({ key: 'showSubscriptionTab' });
        // Explicitly check: if setting exists and is explicitly false, return false, otherwise true
        let showTabEnabled = true; // Default to true
        if (showTab !== null && showTab !== undefined) {
            // Check if value is explicitly false
            if (showTab.value === false || showTab.value === 'false' || showTab.value === 0 || showTab.value === '0') {
                showTabEnabled = false;
            } else {
                showTabEnabled = true;
            }
        }
        
        if (!isPaymentEnabled) {
            return res.status(200).json({
                success: true,
                data: {},
                paymentSystemEnabled: false,
                showSubscriptionTab: showTabEnabled
            });
        }

        // Check additional settings
        const showPlans = await Settings.findOne({ key: 'showSubscriptionPlans' });
        const showPlansEnabled = showPlans === null ? true : (showPlans.value !== false && showPlans.value !== 'false');
        
        if (!showPlansEnabled) {
            return res.status(200).json({
                success: true,
                data: {},
                paymentSystemEnabled: true,
                showSubscriptionTab: showTabEnabled
            });
        }

        // Get user role if authenticated
        const userRole = req.user?.role || 'user';

        // Try to get plans from database first (active and visible)
        const dbPlans = await SubscriptionPlan.find({ 
            isActive: true,
            visible: { $ne: false } // visible is true or undefined
        })
            .sort({ order: 1 });

        // Filter by role and user level
        const filteredPlans = dbPlans.filter(plan => {
            // Check role access
            if (plan.allowedRoles && plan.allowedRoles.length > 0) {
                if (!plan.allowedRoles.includes('all') && !plan.allowedRoles.includes(userRole)) {
                    return false;
                }
            }
            
            // Check user level (if implemented)
            if (plan.minUserLevel && plan.minUserLevel > 0) {
                const userLevel = req.user?.level || 0;
                if (userLevel < plan.minUserLevel) {
                    return false;
                }
            }
            
            return true;
        });

        if (filteredPlans.length > 0) {
            // Convert to object format
            const plansObject = {};
            filteredPlans.forEach(plan => {
                plansObject[plan.name] = {
                    name: plan.displayName,
                    price: plan.price,
                    duration: plan.duration,
                    features: plan.features,
                    maxListings: plan.maxListings,
                    boostCredits: plan.boostCredits,
                    requiresApproval: plan.requiresApproval || false
                };
            });
            return res.status(200).json({
                success: true,
                data: plansObject,
                paymentSystemEnabled: true,
                showSubscriptionTab: showTabEnabled
            });
        }

        // Fallback to legacy plans (only if payment system is enabled)
        return res.status(200).json({
            success: true,
            data: LEGACY_PLANS,
            paymentSystemEnabled: true,
            showSubscriptionTab: showTabEnabled
        });
    } catch (error) {
        Logger.error("Get Subscription Plans Error", error);
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
        
        // Get plan details from database or legacy
        let planDetails = LEGACY_PLANS.free;
        if (user.subscription && user.subscription.plan) {
            const dbPlan = await SubscriptionPlan.findOne({ name: user.subscription.plan });
            if (dbPlan) {
                planDetails = {
                    name: dbPlan.displayName,
                    price: dbPlan.price,
                    duration: dbPlan.duration,
                    features: dbPlan.features,
                    maxListings: dbPlan.maxListings,
                    boostCredits: dbPlan.boostCredits
                };
            } else if (LEGACY_PLANS[user.subscription.plan]) {
                planDetails = LEGACY_PLANS[user.subscription.plan];
            }
        }
        
        return res.status(200).json({
            success: true,
            data: {
                subscription: user.subscription,
                boostCredits: user.boostCredits,
                planDetails: planDetails
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

        // Check if payment system is enabled
        const paymentEnabled = await Settings.findOne({ key: 'paymentSystemEnabled' });
        if (paymentEnabled && paymentEnabled.value === false) {
            return res.status(403).json({
                success: false,
                message: "Payment system is currently disabled"
            });
        }

        // Try to get plan from database first
        let selectedPlan = null;
        const dbPlan = await SubscriptionPlan.findOne({ name: plan, isActive: true });
        if (dbPlan) {
            selectedPlan = {
                name: dbPlan.displayName,
                price: dbPlan.price,
                duration: dbPlan.duration,
                features: dbPlan.features,
                maxListings: dbPlan.maxListings,
                boostCredits: dbPlan.boostCredits
            };
        } else if (LEGACY_PLANS[plan]) {
            selectedPlan = LEGACY_PLANS[plan];
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid subscription plan"
            });
        }
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

