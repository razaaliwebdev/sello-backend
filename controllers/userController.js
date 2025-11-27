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
            .populate("carsPurchased", "title make model price images");

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
