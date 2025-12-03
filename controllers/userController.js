import User from '../models/userModel.js';
import { uploadCloudinary } from '../utils/cloudinary.js';

/**
 * Get User Profile Controller
 */
export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password -otp -otpExpiry")
            .populate("carsPosted", "title make model price images")
            .populate("carsPurchased", "title make model price images")
            .populate("savedCars", "title make model price images");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "User profile retrieved successfully.",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                adminRole: user.adminRole,
                roleId: user.roleId,
                permissions: user.permissions || {},
                status: user.status,
                verified: user.verified,
                isEmailVerified: user.isEmailVerified,
                carsPosted: user.carsPosted,
                carsPurchased: user.carsPurchased,
                savedCars: user.savedCars,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error("Get User Profile Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update User Profile Controller
 */
export const updateProfile = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user._id;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Update name if provided
        if (name) {
            user.name = name.trim();
        }

        // Update avatar if provided
        if (req.file) {
            const avatarUrl = await uploadCloudinary(req.file.buffer);
            user.avatar = avatarUrl;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                status: user.status,
                boostCredits: user.boostCredits,
                subscription: user.subscription
            }
        });
    } catch (error) {
        console.error("Update Profile Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get User Boost Credits
 */
export const getBoostCredits = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("boostCredits subscription totalSpent paymentHistory");
        
        return res.status(200).json({
            success: true,
            message: "Boost credits retrieved successfully.",
            data: {
                boostCredits: user.boostCredits,
                subscription: user.subscription,
                totalSpent: user.totalSpent,
                recentPayments: user.paymentHistory.slice(-5).reverse() // Last 5 payments
            }
        });
    } catch (error) {
        console.error("Get Boost Credits Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Save Car to Wishlist
 */
export const saveCar = async (req, res) => {
    try {
        const { carId } = req.params;
        const userId = req.user._id;

        if (!carId) {
            return res.status(400).json({
                success: false,
                message: "Car ID is required."
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Check if car is already saved
        if (user.savedCars.includes(carId)) {
            return res.status(200).json({
                success: true,
                message: "Car is already saved.",
                data: { saved: true }
            });
        }

        // Add car to saved list
        user.savedCars.push(carId);
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Car saved successfully.",
            data: { saved: true }
        });
    } catch (error) {
        console.error("Save Car Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Unsave Car from Wishlist
 */
export const unsaveCar = async (req, res) => {
    try {
        const { carId } = req.params;
        const userId = req.user._id;

        if (!carId) {
            return res.status(400).json({
                success: false,
                message: "Car ID is required."
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Remove car from saved list
        user.savedCars = user.savedCars.filter(id => id.toString() !== carId.toString());
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Car removed from saved list.",
            data: { saved: false }
        });
    } catch (error) {
        console.error("Unsave Car Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Saved Cars
 */
export const getSavedCars = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("savedCars")
            .populate("savedCars", "title make model year price images condition fuelType transmission mileage city");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Saved cars retrieved successfully.",
            data: user.savedCars || []
        });
    } catch (error) {
        console.error("Get Saved Cars Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};