import Car from '../models/carModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Get All Promotions (Boosted Posts)
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
        const { status, search } = req.query;

        // Build query
        const query = { isBoosted: true };
        
        if (status === 'active') {
            query.boostExpiry = { $gt: new Date() };
        } else if (status === 'expired') {
            query.boostExpiry = { $lte: new Date() };
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { make: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        const promotions = await Car.find(query)
            .populate("postedBy", "name email role")
            .skip(skip)
            .limit(limit)
            .sort({ boostPriority: -1, boostExpiry: -1 });

        const total = await Car.countDocuments(query);

        // Get statistics
        const activePromotions = await Car.countDocuments({ 
            isBoosted: true, 
            boostExpiry: { $gt: new Date() } 
        });
        const expiredPromotions = await Car.countDocuments({ 
            isBoosted: true, 
            boostExpiry: { $lte: new Date() } 
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
            totalRevenue,
            todayPromotions
        ] = await Promise.all([
            Car.countDocuments({ isBoosted: true }),
            Car.countDocuments({ 
                isBoosted: true, 
                boostExpiry: { $gt: new Date() } 
            }),
            Car.countDocuments({ 
                isBoosted: true, 
                boostExpiry: { $lte: new Date() } 
            }),
            User.aggregate([
                { $group: { _id: null, total: { $sum: "$totalSpent" } } }
            ]),
            Car.countDocuments({
                isBoosted: true,
                'boostHistory.boostedAt': {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            })
        ]);

        // Get revenue from boost credits
        const boostRevenue = await User.aggregate([
            {
                $unwind: "$paymentHistory"
            },
            {
                $match: {
                    "paymentHistory.purpose": "boost",
                    "paymentHistory.status": "completed"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$paymentHistory.amount" }
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
                revenue: {
                    total: totalRevenue[0]?.total || 0,
                    fromBoosts: boostRevenue[0]?.total || 0
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

