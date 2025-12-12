import User from '../models/userModel.js';
import Logger from '../utils/logger.js';
import SubscriptionPlan from '../models/subscriptionPlanModel.js';

/**
 * Get All User Payments (Admin)
 */
export const getAllPayments = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view all payments'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Get all users with payment history
        const users = await User.find({
            'paymentHistory.0': { $exists: true }
        })
            .select('name email role paymentHistory totalSpent subscription')
            .skip(skip)
            .limit(limit);

        // Flatten payment history with user info
        const allPayments = [];
        users.forEach(user => {
            if (user.paymentHistory && user.paymentHistory.length > 0) {
                user.paymentHistory.forEach(payment => {
                    allPayments.push({
                        _id: payment._id,
                        userId: user._id,
                        userName: user.name,
                        userEmail: user.email,
                        userRole: user.role,
                        amount: payment.amount,
                        currency: payment.currency,
                        paymentMethod: payment.paymentMethod,
                        transactionId: payment.transactionId,
                        purpose: payment.purpose,
                        status: payment.status,
                        createdAt: payment.createdAt
                    });
                });
            }
        });

        // Sort by date
        allPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const total = await User.countDocuments({
            'paymentHistory.0': { $exists: true }
        });

        return res.status(200).json({
            success: true,
            data: {
                payments: allPayments.slice(0, limit),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        Logger.error('Get All Payments Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching payments'
        });
    }
};

/**
 * Get User Subscriptions (Admin)
 */
export const getAllSubscriptions = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view all subscriptions'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const { status, plan } = req.query;

        const query = {};
        if (status === 'active') {
            query['subscription.isActive'] = true;
            query['subscription.endDate'] = { $gt: new Date() };
        } else if (status === 'expired') {
            query['subscription.endDate'] = { $lt: new Date() };
        }
        if (plan) {
            query['subscription.plan'] = plan;
        }

        const users = await User.find(query)
            .select('name email role subscription totalSpent')
            .skip(skip)
            .limit(limit)
            .sort({ 'subscription.endDate': -1 });

        const subscriptions = users
            .filter(u => u.subscription && u.subscription.plan !== 'free')
            .map(user => ({
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                userRole: user.role,
                plan: user.subscription.plan,
                startDate: user.subscription.startDate,
                endDate: user.subscription.endDate,
                isActive: user.subscription.isActive &&
                    user.subscription.endDate &&
                    new Date(user.subscription.endDate) > new Date(),
                autoRenew: user.subscription.autoRenew,
                totalSpent: user.totalSpent
            }));

        const total = await User.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: {
                subscriptions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        Logger.error('Get All Subscriptions Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching subscriptions'
        });
    }
};

/**
 * Admin: Manually Activate/Update Subscription
 */
export const adminUpdateSubscription = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can update subscriptions'
            });
        }

        const { userId } = req.params;
        const { plan, duration = 30, isActive = true } = req.body;

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
        } else {
            // Fallback to legacy plans
            const { SUBSCRIPTION_PLANS: LEGACY_PLANS } = await import('./subscriptionController.js');
            if (!LEGACY_PLANS[plan]) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subscription plan'
                });
            }
            selectedPlan = LEGACY_PLANS[plan];
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + duration);

        user.subscription = {
            plan: plan,
            startDate: startDate,
            endDate: endDate,
            isActive: isActive,
            autoRenew: false
        };

        // Add boost credits if included in plan
        if (selectedPlan.boostCredits > 0) {
            user.boostCredits += selectedPlan.boostCredits;
        }

        await user.save({ validateBeforeSave: false });

        Logger.info(`Admin ${req.user._id} updated subscription for user ${userId} to ${plan}`);

        return res.status(200).json({
            success: true,
            message: `Subscription updated to ${selectedPlan.name}`,
            data: {
                subscription: user.subscription,
                planDetails: selectedPlan
            }
        });
    } catch (error) {
        Logger.error('Admin Update Subscription Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error updating subscription'
        });
    }
};

/**
 * Admin: Cancel User Subscription
 */
export const adminCancelSubscription = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can cancel subscriptions'
            });
        }

        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Ensure subscription object exists
        if (!user.subscription) {
            user.subscription = {
                plan: 'free',
                isActive: false,
                autoRenew: false
            };
        }

        user.subscription.isActive = false;
        user.subscription.autoRenew = false;
        await user.save({ validateBeforeSave: false });

        Logger.info(`Admin ${req.user._id} cancelled subscription for user ${userId}`);

        return res.status(200).json({
            success: true,
            message: 'Subscription cancelled successfully',
            data: {
                subscription: user.subscription
            }
        });
    } catch (error) {
        Logger.error('Admin Cancel Subscription Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error cancelling subscription'
        });
    }
};

