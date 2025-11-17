import Car from '../models/carModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Boost Post Configuration
 */
const BOOST_CONFIG = {
    PRICE_PER_DAY: 5, // $5 per day
    MIN_DURATION: 1, // minimum 1 day
    MAX_DURATION: 30, // maximum 30 days
    ADMIN_BOOST_PRIORITY: 100, // Admin boosted posts get highest priority
    USER_BOOST_PRIORITY: 50 // User boosted posts get medium priority
};

/**
 * Calculate Boost Cost
 */
const calculateBoostCost = (days) => {
    return days * BOOST_CONFIG.PRICE_PER_DAY;
};

/**
 * Boost a Car Post (User Payment)
 */
export const boostPost = async (req, res) => {
    try {
        const { carId } = req.params;
        const { duration, paymentMethod, transactionId } = req.body;

        // Validate car ID
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        // Validate duration
        const days = parseInt(duration);
        if (!days || days < BOOST_CONFIG.MIN_DURATION || days > BOOST_CONFIG.MAX_DURATION) {
            return res.status(400).json({
                success: false,
                message: `Duration must be between ${BOOST_CONFIG.MIN_DURATION} and ${BOOST_CONFIG.MAX_DURATION} days.`
            });
        }

        // Find car
        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        // Check if user owns the car
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "You can only boost your own posts."
            });
        }

        // Check if car is approved
        if (!car.isApproved) {
            return res.status(400).json({
                success: false,
                message: "Cannot boost unapproved posts. Please wait for admin approval."
            });
        }

        // Calculate cost
        const cost = calculateBoostCost(days);

        // Check if user has enough credits (if using credits)
        if (req.body.useCredits && req.user.boostCredits < cost) {
            return res.status(400).json({
                success: false,
                message: `Insufficient credits. You need ${cost} credits, but you have ${req.user.boostCredits}.`
            });
        }

        // If using credits, deduct them
        if (req.body.useCredits) {
            req.user.boostCredits -= cost;
            await req.user.save({ validateBeforeSave: false });
        } else {
            // In a real app, you would process payment here
            // For now, we'll just record the payment
            req.user.paymentHistory.push({
                amount: cost,
                currency: "USD",
                paymentMethod: paymentMethod || "card",
                transactionId: transactionId || `TXN-${Date.now()}`,
                purpose: "boost",
                status: "completed"
            });
            req.user.totalSpent += cost;
            await req.user.save({ validateBeforeSave: false });
        }

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        // Update car boost status
        car.isBoosted = true;
        car.boostExpiry = expiryDate;
        car.boostPriority = req.user.role === 'admin' ? BOOST_CONFIG.ADMIN_BOOST_PRIORITY : BOOST_CONFIG.USER_BOOST_PRIORITY;
        car.boostHistory.push({
            boostedAt: new Date(),
            boostedBy: req.user._id,
            boostType: req.user.role === 'admin' ? 'admin' : 'user',
            duration: days,
            expiredAt: expiryDate
        });

        await car.save();

        return res.status(200).json({
            success: true,
            message: `Post boosted successfully for ${days} day(s).`,
            data: {
                car: {
                    _id: car._id,
                    title: car.title,
                    isBoosted: car.isBoosted,
                    boostExpiry: car.boostExpiry,
                    boostPriority: car.boostPriority
                },
                cost,
                expiryDate,
                remainingCredits: req.user.boostCredits
            }
        });
    } catch (error) {
        console.error("Boost Post Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Admin Boost Post (Free)
 */
export const adminBoostPost = async (req, res) => {
    try {
        const { carId } = req.params;
        const { duration } = req.body;

        // Check admin access
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can boost posts for free."
            });
        }

        // Validate car ID
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        // Validate duration
        const days = parseInt(duration) || 7; // Default 7 days for admin

        // Find car
        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        // Update car boost status
        car.isBoosted = true;
        car.boostExpiry = expiryDate;
        car.boostPriority = BOOST_CONFIG.ADMIN_BOOST_PRIORITY;
        car.boostHistory.push({
            boostedAt: new Date(),
            boostedBy: req.user._id,
            boostType: 'admin',
            duration: days,
            expiredAt: expiryDate
        });

        await car.save();

        return res.status(200).json({
            success: true,
            message: `Post boosted by admin for ${days} day(s).`,
            data: {
                car: {
                    _id: car._id,
                    title: car.title,
                    isBoosted: car.isBoosted,
                    boostExpiry: car.boostExpiry,
                    boostPriority: car.boostPriority
                },
                boostedBy: req.user.name,
                expiryDate
            }
        });
    } catch (error) {
        console.error("Admin Boost Post Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Remove Boost from Post
 */
export const removeBoost = async (req, res) => {
    try {
        const { carId } = req.params;

        // Validate car ID
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        // Find car
        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        // Check permissions (owner or admin)
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to remove boost from this post."
            });
        }

        // Remove boost
        car.isBoosted = false;
        car.boostExpiry = null;
        car.boostPriority = 0;

        await car.save();

        return res.status(200).json({
            success: true,
            message: "Boost removed successfully.",
            data: {
                car: {
                    _id: car._id,
                    title: car.title,
                    isBoosted: car.isBoosted
                }
            }
        });
    } catch (error) {
        console.error("Remove Boost Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Boost Status
 */
export const getBoostStatus = async (req, res) => {
    try {
        const { carId } = req.params;

        // Validate car ID
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        // Find car
        const car = await Car.findById(carId).select("isBoosted boostExpiry boostPriority boostHistory");
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        // Check if boost is expired
        const isExpired = car.boostExpiry && new Date() > car.boostExpiry;
        if (isExpired && car.isBoosted) {
            car.isBoosted = false;
            car.boostPriority = 0;
            await car.save({ validateBeforeSave: false });
        }

        return res.status(200).json({
            success: true,
            data: {
                isBoosted: car.isBoosted && !isExpired,
                boostExpiry: car.boostExpiry,
                boostPriority: car.boostPriority,
                boostHistory: car.boostHistory,
                isExpired
            }
        });
    } catch (error) {
        console.error("Get Boost Status Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Purchase Boost Credits
 */
export const purchaseCredits = async (req, res) => {
    try {
        const { amount, paymentMethod, transactionId } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount. Amount must be greater than 0."
            });
        }

        // In a real app, you would process payment here
        // For now, we'll just add credits
        req.user.boostCredits += amount;
        req.user.paymentHistory.push({
            amount: amount * BOOST_CONFIG.PRICE_PER_DAY, // Assuming 1 credit = $1
            currency: "USD",
            paymentMethod: paymentMethod || "card",
            transactionId: transactionId || `TXN-${Date.now()}`,
            purpose: "credits",
            status: "completed"
        });
        req.user.totalSpent += amount * BOOST_CONFIG.PRICE_PER_DAY;

        await req.user.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: `Successfully purchased ${amount} boost credits.`,
            data: {
                creditsAdded: amount,
                totalCredits: req.user.boostCredits
            }
        });
    } catch (error) {
        console.error("Purchase Credits Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Boost Pricing Info
 */
export const getBoostPricing = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: {
                pricePerDay: BOOST_CONFIG.PRICE_PER_DAY,
                minDuration: BOOST_CONFIG.MIN_DURATION,
                maxDuration: BOOST_CONFIG.MAX_DURATION,
                pricing: {
                    1: calculateBoostCost(1),
                    3: calculateBoostCost(3),
                    7: calculateBoostCost(7),
                    14: calculateBoostCost(14),
                    30: calculateBoostCost(30)
                }
            }
        });
    } catch (error) {
        console.error("Get Boost Pricing Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

