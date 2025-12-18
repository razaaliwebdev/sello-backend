import User from '../models/userModel.js';
import { uploadCloudinary } from '../utils/cloudinary.js';
import Logger from '../utils/logger.js';

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
                phone: user.phone,
                avatar: user.avatar,
                role: user.role,
                adminRole: user.adminRole,
                roleId: user.roleId,
                permissions: user.permissions || {},
                status: user.status,
                verified: user.verified,
                isEmailVerified: user.isEmailVerified,
                dealerInfo: user.dealerInfo || null,
                subscription: user.subscription || null,
                boostCredits: user.boostCredits || 0,
                sellerRating: user.sellerRating || 0,
                reviewCount: user.reviewCount || 0,
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
 * Update Dealer Profile Controller
 * Allows dealers to update their business information, upload CNIC/license, etc.
 */
export const updateDealerProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.role !== 'dealer') {
            return res.status(403).json({
                success: false,
                message: "Only dealers can update dealer profile."
            });
        }

        // Ensure dealerInfo exists
        if (!user.dealerInfo) {
            user.dealerInfo = {};
        }

        // Update basic user info
        if (req.body.name) {
            const trimmedName = req.body.name.trim();
            if (trimmedName.length >= 2 && trimmedName.length <= 50) {
                user.name = trimmedName;
            }
        }

        if (req.body.phone) {
            if (/^\+?\d{9,15}$/.test(req.body.phone.trim())) {
                user.phone = req.body.phone.trim();
            }
        }

        // Update avatar if provided
        if (req.files && req.files.avatar && req.files.avatar[0]) {
            const avatarUrl = await uploadCloudinary(req.files.avatar[0].buffer, {
                folder: "avatars",
                removeExif: true,
                quality: 80,
                format: "auto"
            });
            user.avatar = avatarUrl;
        }

        // Update dealer-specific information
        const {
            businessName,
            businessAddress,
            businessPhone,
            whatsappNumber,
            city,
            area,
            vehicleTypes,
            description,
            website,
            facebook,
            instagram,
            twitter,
            linkedin,
            establishedYear,
            employeeCount,
            specialties,
            languages,
            paymentMethods,
            services
        } = req.body;

        // Basic dealer info
        if (businessName) user.dealerInfo.businessName = businessName.trim();
        if (businessAddress) user.dealerInfo.businessAddress = businessAddress.trim();
        if (businessPhone) user.dealerInfo.businessPhone = businessPhone.trim();
        if (whatsappNumber) user.dealerInfo.whatsappNumber = whatsappNumber.trim();
        if (city) user.dealerInfo.city = city.trim();
        if (area) user.dealerInfo.area = area.trim();
        if (vehicleTypes) user.dealerInfo.vehicleTypes = vehicleTypes.trim();
        if (description) user.dealerInfo.description = description.trim();
        if (website) user.dealerInfo.website = website.trim();
        if (establishedYear) user.dealerInfo.establishedYear = parseInt(establishedYear);
        if (employeeCount) user.dealerInfo.employeeCount = employeeCount;

        // Social media
        if (!user.dealerInfo.socialMedia) {
            user.dealerInfo.socialMedia = {};
        }
        if (facebook) user.dealerInfo.socialMedia.facebook = facebook.trim();
        if (instagram) user.dealerInfo.socialMedia.instagram = instagram.trim();
        if (twitter) user.dealerInfo.socialMedia.twitter = twitter.trim();
        if (linkedin) user.dealerInfo.socialMedia.linkedin = linkedin.trim();

        // Parse arrays
        if (specialties) {
            try {
                user.dealerInfo.specialties = typeof specialties === 'string'
                    ? JSON.parse(specialties)
                    : (Array.isArray(specialties) ? specialties : specialties.split(',').map(s => s.trim()));
            } catch (e) {
                user.dealerInfo.specialties = typeof specialties === 'string'
                    ? specialties.split(',').map(s => s.trim())
                    : [];
            }
        }

        if (languages) {
            try {
                user.dealerInfo.languages = typeof languages === 'string'
                    ? JSON.parse(languages)
                    : (Array.isArray(languages) ? languages : languages.split(',').map(l => l.trim()));
            } catch (e) {
                user.dealerInfo.languages = typeof languages === 'string'
                    ? languages.split(',').map(l => l.trim())
                    : [];
            }
        }

        if (paymentMethods) {
            try {
                user.dealerInfo.paymentMethods = typeof paymentMethods === 'string'
                    ? JSON.parse(paymentMethods)
                    : (Array.isArray(paymentMethods) ? paymentMethods : paymentMethods.split(',').map(p => p.trim()));
            } catch (e) {
                user.dealerInfo.paymentMethods = typeof paymentMethods === 'string'
                    ? paymentMethods.split(',').map(p => p.trim())
                    : [];
            }
        }

        if (services) {
            try {
                user.dealerInfo.services = typeof services === 'string'
                    ? JSON.parse(services)
                    : (Array.isArray(services) ? services : services.split(',').map(s => s.trim()));
            } catch (e) {
                user.dealerInfo.services = typeof services === 'string'
                    ? services.split(',').map(s => s.trim())
                    : [];
            }
        }

        // Upload business license/CNIC if provided
        if (req.files && req.files.businessLicense && req.files.businessLicense[0]) {
            const licenseUrl = await uploadCloudinary(req.files.businessLicense[0].buffer, {
                folder: "dealer-documents",
                quality: 90
            });
            user.dealerInfo.businessLicense = licenseUrl;
            // Reset verification if license is updated (admin needs to re-verify)
            if (user.dealerInfo.verified) {
                user.dealerInfo.verified = false;
                user.dealerInfo.verifiedAt = null;
            }
        }

        // Upload showroom images if provided
        if (req.files && req.files.showroomImages && req.files.showroomImages.length > 0) {
            const showroomImageUrls = await Promise.all(
                req.files.showroomImages.map(file =>
                    uploadCloudinary(file.buffer, {
                        folder: "showroom-images",
                        quality: 85
                    })
                )
            );
            user.dealerInfo.showroomImages = [
                ...(user.dealerInfo.showroomImages || []),
                ...showroomImageUrls
            ];
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Dealer profile updated successfully.",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                dealerInfo: user.dealerInfo
            }
        });
    } catch (error) {
        Logger.error("Update Dealer Profile Error:", error);
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
 * Request Dealer Status (Convert Profile to Dealer)
 */
export const requestDealer = async (req, res) => {
    try {
        const {
            businessName,
            businessLicense: businessLicenseNumber,
            businessAddress,
            businessPhone,
            whatsappNumber,
            country,
            state,
            city,
            area,
            vehicleTypes,
            description,
            website,
            establishedYear,
            employeeCount,
            specialties,
            languages,
            paymentMethods,
            services,
            facebook,
            instagram,
            twitter,
            linkedin
        } = req.body;

        const userId = req.user._id;

        // Validation
        if (!businessName || !businessName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Business name is required."
            });
        }

        if (!businessAddress || !businessAddress.trim()) {
            return res.status(400).json({
                success: false,
                message: "Business address is required."
            });
        }

        if (!businessPhone || !businessPhone.trim()) {
            return res.status(400).json({
                success: false,
                message: "Business phone number is required."
            });
        }

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

        // Upload business license file if provided
        let businessLicenseUrl = null;
        if (req.files && req.files.businessLicense && req.files.businessLicense[0]) {
            try {
                businessLicenseUrl = await uploadCloudinary(req.files.businessLicense[0].buffer, {
                    folder: "sello_dealers/licenses",
                    removeExif: true,
                    quality: 85,
                    format: "auto"
                });
            } catch (uploadError) {
                Logger.error("Business license upload error", uploadError, { userId });
                return res.status(400).json({
                    success: false,
                    message: "Failed to upload business license. Please try again."
                });
            }
        }

        // Import required models
        const Category = (await import('../models/categoryModel.js')).default;
        const Settings = (await import('../models/settingsModel.js')).default;
        const Notification = (await import('../models/notificationModel.js')).default;
        const mongoose = (await import('mongoose')).default;

        // Look up location category names from IDs if provided
        let countryName = null;
        let stateName = null;
        let cityName = null;

        if (country && mongoose.Types.ObjectId.isValid(country)) {
            const countryCategory = await Category.findById(country);
            if (countryCategory && countryCategory.subType === 'country') {
                countryName = countryCategory.name;
            }
        }

        if (state && mongoose.Types.ObjectId.isValid(state)) {
            const stateCategory = await Category.findById(state);
            if (stateCategory && stateCategory.subType === 'state') {
                stateName = stateCategory.name;
            }
        }

        if (city && mongoose.Types.ObjectId.isValid(city)) {
            const cityCategory = await Category.findById(city);
            if (cityCategory && cityCategory.subType === 'city') {
                cityName = cityCategory.name;
            }
        }

        // Build location string
        const locationParts = [];
        if (area) locationParts.push(area);
        if (cityName) locationParts.push(cityName);
        if (stateName) locationParts.push(stateName);
        if (countryName) locationParts.push(countryName);
        const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : businessAddress;

        // Validate and format social media URLs
        const validateUrl = (url, platform) => {
            if (!url || !url.trim()) return null;
            let urlStr = url.trim();
            if (!urlStr.match(/^https?:\/\//i)) {
                urlStr = `https://${urlStr}`;
            }
            try {
                new URL(urlStr);
                return urlStr;
            } catch (e) {
                Logger.warn(`Invalid ${platform} URL`, { url: urlStr, userId });
                return null;
            }
        };

        // Check if auto-approve dealers is enabled
        const autoApproveDealersSetting = await Settings.findOne({ key: 'autoApproveDealers' });
        const autoApproveDealers = autoApproveDealersSetting &&
            (autoApproveDealersSetting.value === true ||
                autoApproveDealersSetting.value === 'true' ||
                autoApproveDealersSetting.value === 1 ||
                autoApproveDealersSetting.value === '1');

        // Parse JSON strings if they exist (for arrays)
        let parsedSpecialties = [];
        let parsedLanguages = [];
        let parsedPaymentMethods = [];
        let parsedServices = [];

        try {
            if (specialties) {
                if (typeof specialties === 'string') {
                    try {
                        parsedSpecialties = JSON.parse(specialties);
                    } catch {
                        parsedSpecialties = specialties.split(',').map(s => s.trim()).filter(Boolean);
                    }
                } else if (Array.isArray(specialties)) {
                    parsedSpecialties = specialties;
                }
            }
        } catch (e) {
            parsedSpecialties = [];
        }

        try {
            if (languages) {
                if (typeof languages === 'string') {
                    try {
                        parsedLanguages = JSON.parse(languages);
                    } catch {
                        parsedLanguages = languages.split(',').map(l => l.trim()).filter(Boolean);
                    }
                } else if (Array.isArray(languages)) {
                    parsedLanguages = languages;
                }
            }
        } catch (e) {
            parsedLanguages = [];
        }

        try {
            if (paymentMethods) {
                if (typeof paymentMethods === 'string') {
                    try {
                        parsedPaymentMethods = JSON.parse(paymentMethods);
                    } catch {
                        parsedPaymentMethods = paymentMethods.split(',').map(p => p.trim()).filter(Boolean);
                    }
                } else if (Array.isArray(paymentMethods)) {
                    parsedPaymentMethods = paymentMethods;
                }
            }
        } catch (e) {
            parsedPaymentMethods = [];
        }

        try {
            if (services) {
                if (typeof services === 'string') {
                    try {
                        parsedServices = JSON.parse(services);
                    } catch {
                        parsedServices = services.split(',').map(s => s.trim()).filter(Boolean);
                    }
                } else if (Array.isArray(services)) {
                    parsedServices = services;
                }
            }
        } catch (e) {
            parsedServices = [];
        }

        // Update user role and dealer info
        user.role = 'dealer';
        user.isVerified = false;

        // Initialize dealerInfo if it doesn't exist, or merge with existing
        if (!user.dealerInfo) {
            user.dealerInfo = {};
        }

        // Update dealer info with provided data
        user.dealerInfo.businessName = businessName.trim();
        user.dealerInfo.businessLicense = businessLicenseUrl || businessLicenseNumber || user.dealerInfo.businessLicense;
        user.dealerInfo.businessAddress = fullLocation || businessAddress.trim();
        user.dealerInfo.businessPhone = businessPhone.trim();
        if (whatsappNumber) user.dealerInfo.whatsappNumber = whatsappNumber.trim();
        if (country) user.dealerInfo.country = country;
        if (countryName) user.dealerInfo.countryName = countryName;
        if (state) user.dealerInfo.state = state;
        if (stateName) user.dealerInfo.stateName = stateName;
        if (city) user.dealerInfo.city = city;
        if (cityName) user.dealerInfo.cityName = cityName;
        if (area) user.dealerInfo.area = area.trim();
        if (vehicleTypes) user.dealerInfo.vehicleTypes = vehicleTypes.trim();
        if (description) user.dealerInfo.description = description.trim();
        if (website) user.dealerInfo.website = validateUrl(website, 'website');
        if (establishedYear) user.dealerInfo.establishedYear = parseInt(establishedYear);
        if (employeeCount) user.dealerInfo.employeeCount = employeeCount;

        // Social media
        if (!user.dealerInfo.socialMedia) {
            user.dealerInfo.socialMedia = {};
        }
        if (facebook) user.dealerInfo.socialMedia.facebook = validateUrl(facebook, 'facebook');
        if (instagram) user.dealerInfo.socialMedia.instagram = validateUrl(instagram, 'instagram');
        if (twitter) user.dealerInfo.socialMedia.twitter = validateUrl(twitter, 'twitter');
        if (linkedin) user.dealerInfo.socialMedia.linkedin = validateUrl(linkedin, 'linkedin');

        // Arrays
        if (parsedSpecialties.length > 0) user.dealerInfo.specialties = parsedSpecialties;
        if (parsedLanguages.length > 0) user.dealerInfo.languages = parsedLanguages;
        if (parsedPaymentMethods.length > 0) user.dealerInfo.paymentMethods = parsedPaymentMethods;
        if (parsedServices.length > 0) user.dealerInfo.services = parsedServices;

        // Set verification status based on auto-approve setting
        user.dealerInfo.verified = autoApproveDealers;
        user.dealerInfo.verifiedAt = autoApproveDealers ? new Date() : null;

        // Also update phone if not set
        if (!user.phone && businessPhone) {
            user.phone = businessPhone.trim();
        }

        await user.save();

        // Create admin notification for new dealer request (if not auto-approved)
        if (!autoApproveDealers) {
            try {
                const adminUsers = await User.find({ role: 'admin' }).select('_id');
                const siteName = process.env.SITE_NAME || 'Sello';
                const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:3000';

                for (const admin of adminUsers) {
                    await Notification.create({
                        title: 'New Dealer Registration Request',
                        message: `${user.name} (${user.email}) has requested dealer status. Business: ${businessName.trim()}`,
                        type: 'info',
                        recipient: admin._id,
                        actionUrl: `${clientUrl}/admin/dealers?userId=${user._id}`,
                        actionText: 'Review Request'
                    });
                }

                // Socket notification will be handled by the notification system when admins connect
            } catch (notifError) {
                Logger.error("Error creating admin notification for dealer request", notifError, { userId, dealerName: businessName });
                // Don't fail the request if notification fails
            }
        }

        // Send email notification to dealer
        try {
            const sendEmail = (await import('../utils/sendEmail.js')).default;
            const siteName = process.env.SITE_NAME || 'Sello';
            const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:3000';

            const emailSubject = autoApproveDealers
                ? `Welcome! Your Dealer Account is Verified - ${siteName}`
                : `Dealer Registration Request Received - ${siteName}`;

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${emailSubject}</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #FFA602; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 24px;">${autoApproveDealers ? '🎉 Dealer Account Verified!' : 'Dealer Registration Request Received'}</h1>
                    </div>
                    <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p style="font-size: 16px; margin-top: 0;">Hello <strong>${user.name}</strong>,</p>
                        <p style="font-size: 16px;">
                            ${autoApproveDealers
                    ? `Congratulations! Your dealer account for <strong>${businessName.trim()}</strong> has been automatically verified and activated. You can now start posting listings with dealer benefits.`
                    : `Thank you for requesting dealer status for <strong>${businessName.trim()}</strong>. Your request has been received and is pending admin review. You will be notified once your account is verified.`}
                        </p>
                        ${!autoApproveDealers ? `
                        <p style="font-size: 14px; color: #666;">
                            <strong>What happens next?</strong><br>
                            • Our admin team will review your business information<br>
                            • Verification typically takes 1-3 business days<br>
                            • You'll receive an email notification once verified<br>
                            • Verified dealers get priority listing placement and enhanced visibility
                        </p>
                        ` : ''}
                        <div style="margin: 30px 0; text-align: center;">
                            <a href="${clientUrl}/dealer-dashboard" style="background-color: #FFA602; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                ${autoApproveDealers ? 'Go to Dealer Dashboard' : 'View My Profile'}
                            </a>
                        </div>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                            If you have any questions, please contact our support team.
                        </p>
                    </div>
                </body>
                </html>
            `;

            await sendEmail(user.email, emailSubject, emailHtml);
        } catch (emailError) {
            Logger.error("Error sending dealer registration email", emailError, { userId, email: user.email });
            // Don't fail the request if email fails
        }

        Logger.info("Dealer request processed", {
            userId: user._id,
            email: user.email,
            businessName: businessName.trim(),
            autoApproved: autoApproveDealers
        });

        return res.status(200).json({
            success: true,
            message: autoApproveDealers
                ? "Dealer account created and verified successfully!"
                : "Dealer request submitted successfully. Pending admin verification.",
            data: {
                role: user.role,
                isVerified: user.isVerified,
                dealerInfo: {
                    ...user.dealerInfo.toObject(),
                    verified: user.dealerInfo.verified,
                    verifiedAt: user.dealerInfo.verifiedAt
                }
            }
        });
    } catch (error) {
        Logger.error("Request Dealer Error", error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};