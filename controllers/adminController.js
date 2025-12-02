import User from '../models/userModel.js';
import Car from '../models/carModel.js';
import CustomerRequest from '../models/customerRequestModel.js';
import ListingHistory from '../models/listingHistoryModel.js';
import mongoose from 'mongoose';

/**
 * Admin Dashboard Stats
 */
export const getDashboardStats = async (req, res) => {
    try {
        // Check admin access
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can access dashboard stats."
            });
        }

        // Get current month and last month dates
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Get current stats
        const [
            totalUsers,
            totalCars,
            activeListings,
            totalDealers,
            customerRequests,
            totalCarsSold,
            totalRevenue
        ] = await Promise.all([
            User.countDocuments(),
            Car.countDocuments({ isApproved: true, isSold: false }),
            Car.countDocuments({ isApproved: true, isSold: false }),
            User.countDocuments({ role: 'dealer' }),
            CustomerRequest.countDocuments(),
            Car.countDocuments({ isSold: true }),
            User.aggregate([
                { $group: { _id: null, total: { $sum: "$totalSpent" } } }
            ])
        ]);

        // Get current month's counts
        const [
            currentMonthUsers,
            currentMonthCars,
            currentMonthDealers,
            currentMonthCustomerRequests,
            currentMonthCarsSold,
            currentMonthRevenue
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            Car.countDocuments({ isApproved: true, isSold: false, createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            User.countDocuments({ role: 'dealer', createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            CustomerRequest.countDocuments({ createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            Car.countDocuments({ isSold: true, soldAt: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            User.aggregate([
                { $match: { createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
                { $group: { _id: null, total: { $sum: "$totalSpent" } } }
            ])
        ]);

        // Get last month's counts for percentage calculation
        const [
            lastMonthUsers,
            lastMonthCars,
            lastMonthDealers,
            lastMonthCustomerRequests,
            lastMonthCarsSold,
            lastMonthRevenue
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
            Car.countDocuments({ isApproved: true, isSold: false, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
            User.countDocuments({ role: 'dealer', createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
            CustomerRequest.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
            Car.countDocuments({ isSold: true, soldAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
            User.aggregate([
                { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
                { $group: { _id: null, total: { $sum: "$totalSpent" } } }
            ])
        ]);

        // Calculate percentage changes vs last month
        const calculatePercentageChange = (current, last) => {
            if (last === 0) return current > 0 ? 100 : 0;
            return ((current - last) / last) * 100;
        };

        const revenue = totalRevenue[0]?.total || 0;
        const currentRev = currentMonthRevenue[0]?.total || 0;
        const lastRev = lastMonthRevenue[0]?.total || 0;

        // Get sales trends for last 6 months (based on sold cars)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const salesTrends = await Car.aggregate([
            {
                $match: {
                    isSold: true,
                    soldAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$soldAt" },
                        month: { $month: "$soldAt" }
                    },
                    count: { $sum: 1 },
                    revenue: { $sum: "$price" }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        // Get user growth for last 6 months
        const userGrowth = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    newUsers: { $sum: 1 },
                    newDealers: {
                        $sum: { $cond: [{ $eq: ["$role", "dealer"] }, 1, 0] }
                    },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        // Format sales trends data (last 6 months) - Use actual values
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const salesTrendsData = [];
        const userGrowthData = [];

        // Get last 6 months
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthIndex = date.getMonth();
            const year = date.getFullYear();
            
            const salesData = salesTrends.find(s => 
                s._id.month === monthIndex + 1 && s._id.year === year
            );
            const userData = userGrowth.find(u => 
                u._id.month === monthIndex + 1 && u._id.year === year
            );
            
            salesTrendsData.push({
                month: monthNames[monthIndex],
                sales: salesData?.count || 0,
                revenue: salesData?.revenue || 0
            });

            userGrowthData.push({
                month: monthNames[monthIndex],
                newUsers: userData?.newUsers || 0,
                newDealers: userData?.newDealers || 0,
                activeUsers: userData?.activeUsers || 0
            });
        }

        return res.status(200).json({
            success: true,
            message: "Dashboard stats retrieved successfully.",
            data: {
                metrics: [
                    {
                        title: "Total Users",
                        value: totalUsers,
                        change: calculatePercentageChange(currentMonthUsers, lastMonthUsers),
                        icon: "users"
                    },
                    {
                        title: "Total Dealers",
                        value: totalDealers,
                        change: calculatePercentageChange(currentMonthDealers, lastMonthDealers),
                        icon: "dealers"
                    },
                    {
                        title: "Active Listings",
                        value: activeListings,
                        change: calculatePercentageChange(currentMonthCars, lastMonthCars),
                        icon: "listings"
                    },
                    {
                        title: "Customer Requests",
                        value: customerRequests,
                        change: calculatePercentageChange(currentMonthCustomerRequests, lastMonthCustomerRequests),
                        icon: "requests"
                    },
                    {
                        title: "Total Cars Sold",
                        value: totalCarsSold,
                        change: calculatePercentageChange(currentMonthCarsSold, lastMonthCarsSold),
                        icon: "sold"
                    },
                    {
                        title: "Revenue / Payments",
                        value: Math.round(revenue),
                        change: calculatePercentageChange(currentRev, lastRev),
                        icon: "revenue"
                    }
                ],
                salesTrends: salesTrendsData,
                userGrowth: userGrowthData,
                overview: {
                    totalUsers,
                    activeListings,
                    totalDealers,
                    customerRequests,
                    totalCarsSold,
                    totalRevenue: revenue
                }
            }
        });
    } catch (error) {
        console.error("Get Dashboard Stats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Users (Admin)
 */
export const getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all users."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { role, status, search } = req.query;

        // Build query
        const query = {};
        
        // Handle role filter - special case for admin to include team members
        if (role === 'admin') {
            // Fetch users with role='admin' OR those who have adminRole set (team members)
            query.$or = [
                { role: 'admin' },
                { adminRole: { $exists: true, $ne: null } }
            ];
        } else if (role) {
            query.role = role;
        }
        
        if (status) {
            query.status = status;
        }
        
        // Handle search - combine with existing query conditions
        if (search) {
            const searchConditions = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
            
            // If we already have an $or for admin users, combine with $and
            if (query.$or) {
                query.$and = [
                    { $or: query.$or },
                    { $or: searchConditions }
                ];
                delete query.$or;
            } else {
                // Just add search conditions
                query.$or = searchConditions;
            }
        }

        const users = await User.find(query)
            .select("-password -otp -otpExpiry")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Users retrieved successfully.",
            data: {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Users Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single User (Admin)
 */
export const getUserById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view user details."
            });
        }

        const { userId } = req.params;

        const user = await User.findById(userId)
            .select("-password -otp -otpExpiry")
            .populate("carsPosted", "title make model price isBoosted")
            .populate("carsPurchased", "title make model price");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "User retrieved successfully.",
            data: user
        });
    } catch (error) {
        console.error("Get User By ID Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update User (Admin)
 */
export const updateUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update users."
            });
        }

        const { userId } = req.params;
        const { name, role, status, boostCredits, subscription } = req.body;

        // Prevent admin from modifying themselves
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot modify your own account through this endpoint."
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Update fields
        if (name) user.name = name.trim();
        if (role && ['buyer', 'seller', 'admin', 'dealer'].includes(role)) {
            user.role = role;
        }
        if (status && ['active', 'inactive', 'suspended'].includes(status)) {
            user.status = status;
        }
        if (boostCredits !== undefined) {
            user.boostCredits = Math.max(0, parseInt(boostCredits));
        }
        if (subscription) {
            if (subscription.plan) user.subscription.plan = subscription.plan;
            if (subscription.isActive !== undefined) user.subscription.isActive = subscription.isActive;
            if (subscription.startDate) user.subscription.startDate = new Date(subscription.startDate);
            if (subscription.endDate) user.subscription.endDate = new Date(subscription.endDate);
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "User updated successfully.",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                boostCredits: user.boostCredits,
                subscription: user.subscription
            }
        });
    } catch (error) {
        console.error("Update User Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete User (Admin)
 */
export const deleteUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete users."
            });
        }

        const { userId } = req.params;

        // Prevent admin from deleting themselves
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Delete user's cars
        await Car.deleteMany({ postedBy: userId });

        // Delete user
        await user.deleteOne();

        return res.status(200).json({
            success: true,
            message: "User and associated data deleted successfully."
        });
    } catch (error) {
        console.error("Delete User Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Cars (Admin)
 */
export const getAllCars = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all cars."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { status, brand, search } = req.query;

        // Build query
        const query = {};
        
        // Status filter: all, pending, approved, rejected, sold
        if (status && status !== 'all') {
            if (status === 'sold') {
                query.isSold = true;
            } else if (status === 'rejected') {
                query.isApproved = false;
                query.rejectionReason = { $exists: true, $ne: null };
            } else if (status === 'approved') {
                query.isApproved = true;
                query.isSold = { $ne: true };
            } else if (status === 'pending') {
                // Pending: not approved, not sold, and not explicitly rejected
                query.isApproved = { $ne: true };
                query.isSold = { $ne: true };
                query.$or = [
                    { rejectionReason: { $exists: false } },
                    { rejectionReason: null }
                ];
            }
        }
        
        // Brand filter
        if (brand && brand !== 'all') {
            query.make = { $regex: brand, $options: 'i' };
        }
        
        // Search filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { make: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        const cars = await Car.find(query)
            .populate("postedBy", "name email role")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Car.countDocuments(query);

        // Get unique brands for filter dropdown
        const uniqueBrands = await Car.distinct("make");

        return res.status(200).json({
            success: true,
            message: "Cars retrieved successfully.",
            data: {
                cars,
                brands: uniqueBrands.sort(),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Cars (Admin) Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Approve/Reject Car (Admin)
 */
export const approveCar = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can approve/reject cars."
            });
        }

        const { carId } = req.params;
        const { isApproved, rejectionReason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        car.isApproved = isApproved === true || isApproved === 'true';
        car.approvedBy = req.user._id;
        car.approvedAt = new Date();
        if (!car.isApproved && rejectionReason) {
            car.rejectionReason = rejectionReason;
        } else {
            car.rejectionReason = null;
        }

        await car.save();

        return res.status(200).json({
            success: true,
            message: `Car ${car.isApproved ? 'approved' : 'rejected'} successfully.`,
            data: {
                _id: car._id,
                title: car.title,
                isApproved: car.isApproved,
                approvedBy: req.user.name,
                approvedAt: car.approvedAt,
                rejectionReason: car.rejectionReason
            }
        });
    } catch (error) {
        console.error("Approve Car Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Car (Admin)
 */
export const deleteCar = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete cars.",
      });
    }

    const { carId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(carId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid car ID.",
      });
    }

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found.",
      });
    }

    // Create history record BEFORE deletion (no images)
    try {
      await ListingHistory.create({
        oldListingId: car._id,
        title: car.title,
        make: car.make,
        model: car.model,
        year: car.year,
        mileage: car.mileage,
        finalStatus: car.isSold ? "sold" : "deleted",
        finalSellingDate: car.soldAt || car.soldDate || null,
        sellerUser: car.postedBy,
        isAutoDeleted: false,
        deletedBy: req.user._id,
        deletedAt: new Date(),
      });
    } catch (historyError) {
      console.error("Failed to create listing history on admin delete:", historyError);
      // Do not block deletion if history fails, but log it
    }

    // Mark as deleted in case any references remain, then remove
    car.status = "deleted";
    car.deletedAt = new Date();
    car.deletedBy = req.user._id;
    await car.save({ validateBeforeSave: false });

    // Remove car from user's carsPosted array
    await User.findByIdAndUpdate(car.postedBy, {
      $pull: { carsPosted: carId },
    });

    await car.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Car deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Car (Admin) Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Listing History (deleted / sold listings without images)
 * Filters:
 * - status: 'sold' | 'expired' | 'deleted' | 'all'
 * - isAutoDeleted: 'true' | 'false'
 * - from / to: date range on finalSellingDate / deletedAt
 */
export const getListingHistory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view listing history.",
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const { status, isAutoDeleted, from, to, search } = req.query;

    // Build a plain JavaScript query object (this used to have TypeScript-only syntax)
    const query = {};

    if (status && status !== "all") {
      query.finalStatus = status;
    }

    if (isAutoDeleted === "true") {
      query.isAutoDeleted = true;
    } else if (isAutoDeleted === "false") {
      query.isAutoDeleted = false;
    }

    if (from || to) {
      const dateFilter = {};
      if (from) {
        dateFilter.$gte = new Date(from);
      }
      if (to) {
        dateFilter.$lte = new Date(to);
      }
      // Prefer sold date if present, fall back to deletedAt
      query.$or = [
        { finalSellingDate: dateFilter },
        { finalSellingDate: null, deletedAt: dateFilter },
      ];
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        ...(query.$or || []),
        { title: regex },
        { make: regex },
        { model: regex },
      ];
    }

    const [history, total] = await Promise.all([
      ListingHistory.find(query)
        .populate("sellerUser", "name email role")
        .populate("deletedBy", "name email role")
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit),
      ListingHistory.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Listing history retrieved successfully.",
      data: {
        history,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get Listing History Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Feature/Unfeature Car (Admin)
 */
export const featureCar = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can feature cars."
            });
        }

        const { carId } = req.params;
        const { featured } = req.body;

        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        car.featured = featured === true || featured === 'true';
        await car.save();

        return res.status(200).json({
            success: true,
            message: `Car ${car.featured ? 'featured' : 'unfeatured'} successfully.`,
            data: {
                _id: car._id,
                title: car.title,
                featured: car.featured
            }
        });
    } catch (error) {
        console.error("Feature Car Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Dealers (Admin)
 */
export const getAllDealers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all dealers."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { verified, search } = req.query;

        // Build query
        const query = { role: 'dealer' };
        if (verified !== undefined) query['dealerInfo.verified'] = verified === 'true';
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'dealerInfo.businessName': { $regex: search, $options: 'i' } }
            ];
        }

        const dealers = await User.find(query)
            .select("-password -otp -otpExpiry")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        // Get listings and sales counts for each dealer
        const dealersWithStats = await Promise.all(
            dealers.map(async (dealer) => {
                const listingsCount = await Car.countDocuments({ postedBy: dealer._id });
                const salesCount = await Car.countDocuments({ 
                    postedBy: dealer._id, 
                    isSold: true 
                });
                
                return {
                    ...dealer.toObject(),
                    listingsCount,
                    salesCount
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Dealers retrieved successfully.",
            data: {
                dealers: dealersWithStats,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Dealers Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Verify Dealer (Admin)
 */
export const verifyDealer = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can verify dealers."
            });
        }

        const { userId } = req.params;
        const { verified } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.role !== 'dealer') {
            return res.status(400).json({
                success: false,
                message: "User is not a dealer."
            });
        }

        user.dealerInfo.verified = verified === true || verified === 'true';
        user.dealerInfo.verifiedAt = verified ? new Date() : null;

        await user.save();

        return res.status(200).json({
            success: true,
            message: `Dealer ${user.dealerInfo.verified ? 'verified' : 'unverified'} successfully.`,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                dealerInfo: user.dealerInfo
            }
        });
    } catch (error) {
        console.error("Verify Dealer Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

