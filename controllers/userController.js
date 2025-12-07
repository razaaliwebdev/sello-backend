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
        const { name, phone } = req.body;
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
            const trimmedName = name.trim();
            if (trimmedName.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be at least 2 characters."
                });
            }
            if (trimmedName.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: "Name cannot exceed 50 characters."
                });
            }
            user.name = trimmedName;
        }

        // Update phone if provided
        if (phone !== undefined) {
            if (phone && phone.trim() !== '') {
                // Basic phone validation
                if (!/^\+?\d{9,15}$/.test(phone.trim())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid phone number format."
                    });
                }
                user.phone = phone.trim();
            } else {
                user.phone = null;
            }
        }

        // Update avatar if provided
        if (req.file) {
            // Validate file type and size
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB for avatars
            
            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid file type. Only JPEG, PNG, and WebP are allowed."
                });
            }
            
            if (req.file.size > maxSize) {
                return res.status(400).json({
                    success: false,
                    message: "File too large. Maximum size is 5MB."
                });
            }
            
            const avatarUrl = await uploadCloudinary(req.file.buffer, {
                folder: "avatars",
                removeExif: true,
                quality: 80,
                format: "auto"
            });
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
                phone: user.phone,
                avatar: user.avatar,
                role: user.role,
                status: user.status,
                isVerified: user.isVerified,
                sellerRating: user.sellerRating,
                reviewCount: user.reviewCount,
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

        // Track analytics
        try {
            const { trackEvent, AnalyticsEvents } = await import('../utils/analytics.js');
            await trackEvent(AnalyticsEvents.LISTING_SAVE, req.user._id, {
                carId: carId.toString()
            });
        } catch (analyticsError) {
            // Don't fail the request if analytics fails
            console.error('Failed to track analytics:', analyticsError);
        }

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

/**
 * Request Seller Status
 * Individual users can already sell, so this function is kept for backward compatibility
 * but now just confirms their current status
 */
export const requestSeller = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Individual users can already buy and sell
        if (user.role === 'individual') {
            return res.status(200).json({
                success: true,
                message: "You can already create posts as an individual user. You can both buy and sell.",
                data: {
                    role: user.role,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                }
            });
        }

        if (user.role === 'dealer') {
            return res.status(200).json({
                success: true,
                message: "You are already a dealer. Dealers can create posts.",
                data: {
                    role: user.role,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                }
            });
        }

        if (user.role === 'admin') {
            return res.status(200).json({
                success: true,
                message: "Admins can already create posts.",
                data: {
                    role: user.role,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                }
            });
        }

        return res.status(400).json({
            success: false,
            message: "Unknown user role."
        });
    } catch (error) {
        console.error("Request Seller Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Request Dealer Status
 */
export const requestDealer = async (req, res) => {
    try {
        const { businessName, businessLicense, businessAddress, businessPhone } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.role === 'dealer') {
            return res.status(400).json({
                success: false,
                message: "You are already a dealer."
            });
        }

        user.role = 'dealer';
        user.isVerified = false;
        user.dealerInfo = {
            businessName,
            businessLicense,
            businessAddress,
            businessPhone,
            verified: false,
            verifiedAt: null
        };

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Dealer request submitted successfully. Pending admin verification.",
            data: {
                role: user.role,
                isVerified: user.isVerified,
                dealerInfo: user.dealerInfo
            }
        });
    } catch (error) {
        console.error("Request Dealer Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};