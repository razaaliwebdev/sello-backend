import User from '../models/userModel.js';
import Car from '../models/carModel.js';
import Blog from '../models/blogModel.js';
import { Chat, Message } from '../models/chatModel.js';
import Notification from '../models/notificationModel.js';

/**
 * Get Reports & Analytics
 */
export const getAnalytics = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view analytics."
            });
        }

        const { period = '30' } = req.query; // days
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // User Analytics
        const [
            totalUsers,
            newUsers,
            activeUsers,
            suspendedUsers,
            totalDealers,
            verifiedDealers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: startDate } }),
            User.countDocuments({ status: 'active', lastLogin: { $gte: startDate } }),
            User.countDocuments({ status: 'suspended' }),
            User.countDocuments({ role: 'dealer' }),
            User.countDocuments({ role: 'dealer', 'dealerInfo.verified': true })
        ]);

        // Car Analytics
        const [
            totalCars,
            newCars,
            approvedCars,
            pendingCars,
            boostedCars,
            featuredCars,
            totalViews
        ] = await Promise.all([
            Car.countDocuments(),
            Car.countDocuments({ createdAt: { $gte: startDate } }),
            Car.countDocuments({ isApproved: true }),
            Car.countDocuments({ isApproved: false }),
            Car.countDocuments({ isBoosted: true, boostExpiry: { $gt: new Date() } }),
            Car.countDocuments({ featured: true }),
            Car.aggregate([
                { $group: { _id: null, total: { $sum: "$views" } } }
            ])
        ]);

        // Blog Analytics
        const [
            totalBlogs,
            publishedBlogs,
            draftBlogs,
            blogViews
        ] = await Promise.all([
            Blog.countDocuments(),
            Blog.countDocuments({ status: 'published' }),
            Blog.countDocuments({ status: 'draft' }),
            Blog.aggregate([
                { $group: { _id: null, total: { $sum: "$views" } } }
            ])
        ]);

        // Revenue Analytics
        const revenueData = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalSpent" },
                    totalBoostCredits: { $sum: "$boostCredits" }
                }
            }
        ]);

        // Chat Analytics
        const [
            totalChats,
            activeChats,
            reportedChats,
            totalMessages
        ] = await Promise.all([
            Chat.countDocuments(),
            Chat.countDocuments({ isActive: true }),
            Chat.countDocuments({ reported: true }),
            Message.countDocuments({ isDeleted: false })
        ]);

        // Notification Analytics
        const [
            totalNotifications,
            unreadNotifications
        ] = await Promise.all([
            Notification.countDocuments(),
            Notification.countDocuments({ isRead: false })
        ]);

        // User Growth (last 7 days)
        const userGrowth = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Car Growth (last 7 days)
        const carGrowth = await Car.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Most Viewed Cars (top 10)
        const mostViewedCars = await Car.find({ isApproved: true })
            .select("title make model price views isSold images")
            .populate("postedBy", "name")
            .sort({ views: -1 })
            .limit(10)
            .lean();

        // Total Promotions (boosted cars)
        const totalPromotions = await Car.countDocuments({ 
            isBoosted: true, 
            boostExpiry: { $gt: new Date() } 
        });

        // Revenue for recent month comparison
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);
        
        const lastMonthStart = new Date(currentMonthStart);
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
        
        const lastMonthEnd = new Date(currentMonthStart);
        lastMonthEnd.setDate(0);
        lastMonthEnd.setHours(23, 59, 59, 999);

        // Calculate revenue from payment history
        const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
            User.aggregate([
                { $unwind: { path: "$paymentHistory", preserveNullAndEmptyArrays: true } },
                {
                    $match: {
                        'paymentHistory.createdAt': { $gte: currentMonthStart },
                        'paymentHistory.status': 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$paymentHistory.amount" }
                    }
                }
            ]),
            User.aggregate([
                { $unwind: { path: "$paymentHistory", preserveNullAndEmptyArrays: true } },
                {
                    $match: {
                        'paymentHistory.createdAt': { 
                            $gte: lastMonthStart,
                            $lte: lastMonthEnd
                        },
                        'paymentHistory.status': 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$paymentHistory.amount" }
                    }
                }
            ])
        ]);

        const currentRevenue = currentMonthRevenue[0]?.total || 0;
        const lastRevenue = lastMonthRevenue[0]?.total || 0;
        const revenueChange = lastRevenue > 0 
            ? ((currentRevenue - lastRevenue) / lastRevenue * 100).toFixed(1)
            : 0;

        // Promotions change (current month vs last month)
        const [currentMonthPromotions, lastMonthPromotions] = await Promise.all([
            Car.countDocuments({ 
                isBoosted: true,
                boostExpiry: { $gt: new Date() },
                createdAt: { $gte: currentMonthStart }
            }),
            Car.countDocuments({ 
                isBoosted: true,
                boostExpiry: { $gt: new Date() },
                createdAt: { 
                    $gte: lastMonthStart,
                    $lte: lastMonthEnd
                }
            })
        ]);

        const promotionsChange = lastMonthPromotions > 0
            ? ((currentMonthPromotions - lastMonthPromotions) / lastMonthPromotions * 100).toFixed(1)
            : 0;

        // Views change (current month vs last month)
        const [currentMonthViews, lastMonthViews] = await Promise.all([
            Car.aggregate([
                {
                    $match: {
                        createdAt: { $gte: currentMonthStart }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$views" }
                    }
                }
            ]),
            Car.aggregate([
                {
                    $match: {
                        createdAt: { 
                            $gte: lastMonthStart,
                            $lte: lastMonthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$views" }
                    }
                }
            ])
        ]);

        const currentViews = currentMonthViews[0]?.total || 0;
        const lastViews = lastMonthViews[0]?.total || 0;
        const viewsChange = lastViews > 0
            ? ((currentViews - lastViews) / lastViews * 100).toFixed(1)
            : 0;

        return res.status(200).json({
            success: true,
            message: "Analytics retrieved successfully.",
            data: {
                period: days,
                users: {
                    total: totalUsers,
                    new: newUsers,
                    active: activeUsers,
                    suspended: suspendedUsers,
                    dealers: {
                        total: totalDealers,
                        verified: verifiedDealers
                    },
                    growth: userGrowth
                },
                cars: {
                    total: totalCars,
                    new: newCars,
                    approved: approvedCars,
                    pending: pendingCars,
                    boosted: boostedCars,
                    featured: featuredCars,
                    totalViews: totalViews[0]?.total || 0,
                    growth: carGrowth
                },
                blogs: {
                    total: totalBlogs,
                    published: publishedBlogs,
                    draft: draftBlogs,
                    totalViews: blogViews[0]?.total || 0
                },
                revenue: {
                    total: revenueData[0]?.totalRevenue || 0,
                    totalBoostCredits: revenueData[0]?.totalBoostCredits || 0
                },
                chats: {
                    total: totalChats,
                    active: activeChats,
                    reported: reportedChats,
                    totalMessages
                },
                notifications: {
                    total: totalNotifications,
                    unread: unreadNotifications
                },
                mostViewedCars,
                promotions: {
                    total: totalPromotions,
                    change: parseFloat(promotionsChange)
                },
                earnings: {
                    total: revenueData[0]?.totalRevenue || 0,
                    change: parseFloat(revenueChange)
                },
                views: {
                    total: totalViews[0]?.total || 0,
                    change: parseFloat(viewsChange)
                }
            }
        });
    } catch (error) {
        console.error("Get Analytics Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

