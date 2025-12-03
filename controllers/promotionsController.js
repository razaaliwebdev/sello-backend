import Promotion from '../models/promotionModel.js';
import mongoose from 'mongoose';

/**
 * Create Promotion
 */
export const createPromotion = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create promotions."
            });
        }

        const {
            title,
            description,
            promoCode,
            discountType,
            discountValue,
            usageLimit,
            startDate,
            endDate,
            targetAudience,
            status,
            minPurchaseAmount,
            maxDiscountAmount
        } = req.body;

        // Validation
        if (!title || !promoCode || !discountType || !discountValue || !usageLimit || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields."
            });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: "End date must be after start date."
            });
        }

        if (end < new Date()) {
            return res.status(400).json({
                success: false,
                message: "End date cannot be in the past."
            });
        }

        // Validate discount value
        if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
            return res.status(400).json({
                success: false,
                message: "Percentage discount must be between 0 and 100."
            });
        }

        if (discountType === 'fixed' && discountValue < 0) {
            return res.status(400).json({
                success: false,
                message: "Fixed discount must be greater than 0."
            });
        }

        // Check if promo code already exists
        const existingPromotion = await Promotion.findOne({ 
            promoCode: promoCode.toUpperCase().trim() 
        });

        if (existingPromotion) {
            return res.status(409).json({
                success: false,
                message: "Promo code already exists. Please use a different code."
            });
        }

        const promotion = await Promotion.create({
            title: title.trim(),
            description: description || "",
            promoCode: promoCode.toUpperCase().trim(),
            discountType,
            discountValue: parseFloat(discountValue),
            usageLimit: parseInt(usageLimit),
            startDate: start,
            endDate: end,
            targetAudience: targetAudience || "all",
            status: status || "active",
            minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0,
            maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Promotion created successfully.",
            data: promotion
        });
    } catch (error) {
        console.error("Create Promotion Error:", error.message);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Promo code already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Promotions
 */
export const getAllPromotions = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all promotions."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { status, search, targetAudience } = req.query;

        const query = {};
        
        if (status) {
            query.status = status;
        }
        
        if (targetAudience) {
            query.targetAudience = targetAudience;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { promoCode: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const promotions = await Promotion.find(query)
            .populate("createdBy", "name email")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Promotion.countDocuments(query);

        // Get statistics
        const activePromotions = await Promotion.countDocuments({ 
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            $expr: { $lt: ["$usedCount", "$usageLimit"] }
        });
        
        const expiredPromotions = await Promotion.countDocuments({ 
            $or: [
                { status: 'expired' },
                { endDate: { $lt: new Date() } }
            ]
        });

        return res.status(200).json({
            success: true,
            message: "Promotions retrieved successfully.",
            data: {
                promotions,
                statistics: {
                    total,
                    active: activePromotions,
                    expired: expiredPromotions
                },
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Promotions Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Promotion
 */
export const getPromotionById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view promotions."
            });
        }

        const { promotionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(promotionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid promotion ID."
            });
        }

        const promotion = await Promotion.findById(promotionId)
            .populate("createdBy", "name email");

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: "Promotion not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Promotion retrieved successfully.",
            data: promotion
        });
    } catch (error) {
        console.error("Get Promotion Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Promotion
 */
export const updatePromotion = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update promotions."
            });
        }

        const { promotionId } = req.params;
        const {
            title,
            description,
            promoCode,
            discountType,
            discountValue,
            usageLimit,
            startDate,
            endDate,
            targetAudience,
            status,
            minPurchaseAmount,
            maxDiscountAmount
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(promotionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid promotion ID."
            });
        }

        const promotion = await Promotion.findById(promotionId);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: "Promotion not found."
            });
        }

        // Validate dates if provided
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start >= end) {
                return res.status(400).json({
                    success: false,
                    message: "End date must be after start date."
                });
            }
        }

        // Check if promo code is being changed and if it already exists
        if (promoCode && promoCode.toUpperCase().trim() !== promotion.promoCode) {
            const existingPromotion = await Promotion.findOne({ 
                promoCode: promoCode.toUpperCase().trim(),
                _id: { $ne: promotionId }
            });

            if (existingPromotion) {
                return res.status(409).json({
                    success: false,
                    message: "Promo code already exists. Please use a different code."
                });
            }
        }

        // Update fields
        if (title) promotion.title = title.trim();
        if (description !== undefined) promotion.description = description;
        if (promoCode) promotion.promoCode = promoCode.toUpperCase().trim();
        if (discountType) promotion.discountType = discountType;
        if (discountValue !== undefined) promotion.discountValue = parseFloat(discountValue);
        if (usageLimit !== undefined) promotion.usageLimit = parseInt(usageLimit);
        if (startDate) promotion.startDate = new Date(startDate);
        if (endDate) promotion.endDate = new Date(endDate);
        if (targetAudience) promotion.targetAudience = targetAudience;
        if (status) promotion.status = status;
        if (minPurchaseAmount !== undefined) promotion.minPurchaseAmount = parseFloat(minPurchaseAmount);
        if (maxDiscountAmount !== undefined) promotion.maxDiscountAmount = maxDiscountAmount ? parseFloat(maxDiscountAmount) : null;

        // Auto-update status based on dates
        const now = new Date();
        if (promotion.endDate < now) {
            promotion.status = 'expired';
        }

        await promotion.save();

        return res.status(200).json({
            success: true,
            message: "Promotion updated successfully.",
            data: promotion
        });
    } catch (error) {
        console.error("Update Promotion Error:", error.message);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Promo code already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Promotion
 */
export const deletePromotion = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete promotions."
            });
        }

        const { promotionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(promotionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid promotion ID."
            });
        }

        const promotion = await Promotion.findById(promotionId);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: "Promotion not found."
            });
        }

        await promotion.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Promotion deleted successfully."
        });
    } catch (error) {
        console.error("Delete Promotion Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Promotion Statistics
 */
export const getPromotionStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view promotion statistics."
            });
        }

        const [
            totalPromotions,
            activePromotions,
            expiredPromotions,
            todayPromotions
        ] = await Promise.all([
            Promotion.countDocuments({}),
            Promotion.countDocuments({ 
                status: 'active',
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                $expr: { $lt: ["$usedCount", "$usageLimit"] }
            }),
            Promotion.countDocuments({ 
                $or: [
                    { status: 'expired' },
                    { endDate: { $lt: new Date() } }
                ]
            }),
            Promotion.countDocuments({
                createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            })
        ]);

        // Get total usage across all promotions
        const totalUsage = await Promotion.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$usedCount" }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Promotion statistics retrieved successfully.",
            data: {
                promotions: {
                    total: totalPromotions,
                    active: activePromotions,
                    expired: expiredPromotions,
                    today: todayPromotions
                },
                usage: {
                    total: totalUsage[0]?.total || 0
                }
            }
        });
    } catch (error) {
        console.error("Get Promotion Stats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Validate Promo Code (Public endpoint for users)
 */
export const validatePromoCode = async (req, res) => {
    try {
        const { promoCode, amount } = req.body;

        if (!promoCode) {
            return res.status(400).json({
                success: false,
                message: "Promo code is required."
            });
        }

        const promotion = await Promotion.findOne({ 
            promoCode: promoCode.toUpperCase().trim() 
        });

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: "Invalid promo code."
            });
        }

        // Check if promotion can be used
        if (!promotion.canBeUsed()) {
            return res.status(400).json({
                success: false,
                message: "This promo code is no longer valid."
            });
        }

        // Check minimum purchase amount
        if (amount && promotion.minPurchaseAmount > 0 && amount < promotion.minPurchaseAmount) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase amount of $${promotion.minPurchaseAmount} required.`
            });
        }

        // Calculate discount
        const discount = promotion.calculateDiscount(amount || 0);

        return res.status(200).json({
            success: true,
            message: "Promo code is valid.",
            data: {
                promotion: {
                    _id: promotion._id,
                    title: promotion.title,
                    promoCode: promotion.promoCode,
                    discountType: promotion.discountType,
                    discountValue: promotion.discountValue,
                    maxDiscountAmount: promotion.maxDiscountAmount
                },
                discount
            }
        });
    } catch (error) {
        console.error("Validate Promo Code Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
