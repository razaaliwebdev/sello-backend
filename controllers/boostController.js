import Car from '../models/carModel.js';
import User from '../models/userModel.js';
import Logger from '../utils/logger.js';
import { SUBSCRIPTION_PLANS } from './subscriptionController.js';

/**
 * Boost/Promote Post - User can boost their own post
 * Uses boost credits or charges via payment
 */
export const boostPost = async (req, res) => {
    try {
        const { carId } = req.params;
        const { duration = 7, useCredits = true } = req.body; // duration in days

        if (!carId) {
            return res.status(400).json({
                success: false,
                message: 'Car ID is required'
            });
        }

        // Find car
        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        // Check if user owns the car
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You can only boost your own posts'
            });
        }

        // Check if car is already boosted and not expired
        if (car.isBoosted && car.boostExpiry && new Date(car.boostExpiry) > new Date()) {
            return res.status(400).json({
                success: false,
                message: 'This post is already boosted. Wait for it to expire or extend the boost.'
            });
        }

        const user = await User.findById(req.user._id);
        const boostCost = 5; // Cost per day in boost credits or USD

        // If using credits
        if (useCredits && user.boostCredits >= (boostCost * duration)) {
            // Deduct credits
            user.boostCredits -= (boostCost * duration);
            await user.save();

            // Boost the car
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + duration);

            car.isBoosted = true;
            car.boostExpiry = expiryDate;
            car.boostPriority = 50; // User boost priority
            car.boostHistory.push({
                boostedAt: new Date(),
                boostedBy: req.user._id,
                boostType: 'user',
                duration: duration,
                expiredAt: expiryDate
            });

            await car.save();

            Logger.info(`User ${req.user._id} boosted car ${carId} using credits`);

            return res.status(200).json({
                success: true,
                message: `Post boosted for ${duration} days`,
                data: {
                    car,
                    remainingCredits: user.boostCredits
                }
            });
        } else {
            // Need payment
            return res.status(402).json({
                success: false,
                message: 'Insufficient boost credits. Payment required.',
                requiresPayment: true,
                cost: boostCost * duration,
                duration: duration,
                carId: carId
            });
        }
    } catch (error) {
        Logger.error('Boost Post Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error boosting post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Admin Promote Post - Admin can promote any post and charge user
 */
export const adminPromotePost = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can promote posts'
            });
        }

        const { carId } = req.params;
        const { duration = 7, chargeUser = true, priority = 100 } = req.body;

        if (!carId) {
            return res.status(400).json({
                success: false,
                message: 'Car ID is required'
            });
        }

        const car = await Car.findById(carId).populate('postedBy');
        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + duration);

        // Update car
        car.isBoosted = true;
        car.boostExpiry = expiryDate;
        car.boostPriority = priority; // Admin can set higher priority
        car.boostHistory.push({
            boostedAt: new Date(),
            boostedBy: req.user._id,
            boostType: 'admin',
            duration: duration,
            expiredAt: expiryDate
        });

        await car.save();

        // Charge user if requested
        if (chargeUser && car.postedBy) {
            const boostCost = 5 * duration; // Cost per day
            const owner = await User.findById(car.postedBy._id);
            
            if (owner.boostCredits >= boostCost) {
                owner.boostCredits -= boostCost;
            } else {
                // Add to payment history for manual payment
                owner.paymentHistory.push({
                    amount: boostCost,
                    currency: 'USD',
                    paymentMethod: 'admin_charge',
                    transactionId: `ADMIN-BOOST-${Date.now()}`,
                    purpose: 'boost',
                    status: 'pending',
                    createdAt: new Date()
                });
            }
            await owner.save();
        }

        Logger.info(`Admin ${req.user._id} promoted car ${carId}`);

        return res.status(200).json({
            success: true,
            message: `Post promoted for ${duration} days`,
            data: { car }
        });
    } catch (error) {
        Logger.error('Admin Promote Post Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error promoting post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Boost Options - Returns boost pricing and user credits
 */
export const getBoostOptions = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('boostCredits subscription');
        const plan = SUBSCRIPTION_PLANS[user.subscription?.plan || 'free'];

        return res.status(200).json({
            success: true,
            data: {
                boostCredits: user.boostCredits,
                costPerDay: 5,
                availableDurations: [3, 7, 14, 30],
                planBoostCredits: plan.boostCredits || 0
            }
        });
    } catch (error) {
        Logger.error('Get Boost Options Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching boost options'
        });
    }
};

/**
 * Get Boost Pricing (Public)
 */
export const getBoostPricing = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: {
                costPerDay: 5,
                availableDurations: [3, 7, 14, 30],
                pricing: {
                    3: 15,
                    7: 35,
                    14: 70,
                    30: 150
                }
            }
        });
    } catch (error) {
        Logger.error('Get Boost Pricing Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching boost pricing'
        });
    }
};

/**
 * Get Boost Status
 */
export const getBoostStatus = async (req, res) => {
    try {
        const { carId } = req.params;
        const car = await Car.findById(carId).select('isBoosted boostExpiry boostPriority boostHistory');

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                isBoosted: car.isBoosted,
                boostExpiry: car.boostExpiry,
                boostPriority: car.boostPriority,
                boostHistory: car.boostHistory
            }
        });
    } catch (error) {
        Logger.error('Get Boost Status Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching boost status'
        });
    }
};

/**
 * Remove Boost
 */
export const removeBoost = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can remove boosts'
            });
        }

        const { carId } = req.params;
        const car = await Car.findById(carId);

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        car.isBoosted = false;
        car.boostExpiry = null;
        car.boostPriority = 0;
        await car.save();

        return res.status(200).json({
            success: true,
            message: 'Boost removed successfully',
            data: { car }
        });
    } catch (error) {
        Logger.error('Remove Boost Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error removing boost'
        });
    }
};

/**
 * Admin Boost Post (alias for adminPromotePost)
 */
export const adminBoostPost = adminPromotePost;

/**
 * Purchase Credits
 */
export const purchaseCredits = async (req, res) => {
    try {
        const { amount } = req.body; // amount in USD

        if (!amount || amount < 5) {
            return res.status(400).json({
                success: false,
                message: 'Minimum purchase is $5'
            });
        }

        // This would typically create a Stripe checkout session
        // For now, return payment required
        return res.status(402).json({
            success: false,
            message: 'Payment required to purchase credits',
            requiresPayment: true,
            amount: amount
        });
    } catch (error) {
        Logger.error('Purchase Credits Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error purchasing credits'
        });
    }
};
