import mongoose from "mongoose";
import Car from "../models/carModel.js";
import User from "../models/userModel.js";
import Logger from "../utils/logger.js";
import sendEmail from "../utils/sendEmail.js";
import {
  getCarApprovedTemplate,
  getCarRejectedTemplate,
} from "../utils/emailTemplates.js";
import CustomerRequest from "../models/customerRequestModel.js";
import ListingHistory from "../models/listingHistoryModel.js";
import { getAuditLogs } from "../utils/auditLogger.js";

/**
 * Admin Dashboard Stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Check admin access
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can access dashboard stats.",
      });
    }

    // Get current month and last month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    // Get current stats
    const [
      totalUsers,
      totalCars,
      activeListings,
      totalDealers,
      customerRequests,
      totalCarsSold,
      totalRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      Car.countDocuments({ isApproved: true, isSold: false }),
      Car.countDocuments({ isApproved: true, isSold: false }),
      User.countDocuments({ role: "dealer" }),
      CustomerRequest.countDocuments(),
      Car.countDocuments({ isSold: true }),
      User.aggregate([
        { $group: { _id: null, total: { $sum: "$totalSpent" } } },
      ]),
    ]);

    // Get current month's counts
    const [
      currentMonthUsers,
      currentMonthCars,
      currentMonthDealers,
      currentMonthCustomerRequests,
      currentMonthCarsSold,
      currentMonthRevenue,
    ] = await Promise.all([
      User.countDocuments({
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Car.countDocuments({
        isApproved: true,
        isSold: false,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      User.countDocuments({
        role: "dealer",
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      CustomerRequest.countDocuments({
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Car.countDocuments({
        isSold: true,
        soldAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalSpent" } } },
      ]),
    ]);

    // Get last month's counts for percentage calculation
    const [
      lastMonthUsers,
      lastMonthCars,
      lastMonthDealers,
      lastMonthCustomerRequests,
      lastMonthCarsSold,
      lastMonthRevenue,
    ] = await Promise.all([
      User.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),
      Car.countDocuments({
        isApproved: true,
        isSold: false,
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),
      User.countDocuments({
        role: "dealer",
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),
      CustomerRequest.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),
      Car.countDocuments({
        isSold: true,
        soldAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),
      User.aggregate([
        { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: "$totalSpent" } } },
      ]),
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
          soldAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$soldAt" },
            month: { $month: "$soldAt" },
          },
          count: { $sum: 1 },
          revenue: { $sum: "$price" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Get user growth for last 6 months
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newUsers: { $sum: 1 },
          newDealers: {
            $sum: { $cond: [{ $eq: ["$role", "dealer"] }, 1, 0] },
          },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Format sales trends data (last 6 months) - Use actual values
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
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

      const salesData = salesTrends.find(
        (s) => s._id.month === monthIndex + 1 && s._id.year === year
      );
      const userData = userGrowth.find(
        (u) => u._id.month === monthIndex + 1 && u._id.year === year
      );

      salesTrendsData.push({
        month: monthNames[monthIndex],
        sales: salesData?.count || 0,
        revenue: salesData?.revenue || 0,
      });

      userGrowthData.push({
        month: monthNames[monthIndex],
        newUsers: userData?.newUsers || 0,
        newDealers: userData?.newDealers || 0,
        activeUsers: userData?.activeUsers || 0,
      });
    }

    // Get pending verifications count
    const pendingVerifications = await User.countDocuments({
      role: "dealer",
      isVerified: false,
    });

    return res.status(200).json({
      success: true,
      message: "Dashboard stats retrieved successfully.",
      data: {
        metrics: [
          {
            title: "Total Users",
            value: totalUsers,
            change: calculatePercentageChange(
              currentMonthUsers,
              lastMonthUsers
            ),
            icon: "users",
          },
          {
            title: "Total Dealers",
            value: totalDealers,
            change: calculatePercentageChange(
              currentMonthDealers,
              lastMonthDealers
            ),
            icon: "dealers",
          },
          {
            title: "Active Listings",
            value: activeListings,
            change: calculatePercentageChange(currentMonthCars, lastMonthCars),
            icon: "listings",
          },
          {
            title: "Pending Verifications",
            value: pendingVerifications,
            change: 0, // Real-time metric, no history yet
            icon: "requests",
          },
          {
            title: "Total Cars Sold",
            value: totalCarsSold,
            change: calculatePercentageChange(
              currentMonthCarsSold,
              lastMonthCarsSold
            ),
            icon: "sold",
          },
          {
            title: "Revenue / Payments",
            value: Math.round(revenue),
            change: calculatePercentageChange(currentRev, lastRev),
            icon: "revenue",
          },
        ],
        salesTrends: salesTrendsData,
        userGrowth: userGrowthData,
        overview: {
          totalUsers,
          activeListings,
          totalDealers,
          customerRequests,
          totalCarsSold,
          totalRevenue: revenue,
          pendingVerifications,
        },
      },
    });
  } catch (error) {
    Logger.error("Get Dashboard Stats Error", error, { userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Verify User (Admin)
 */
export const verifyUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can verify users.",
      });
    }

    const { userId } = req.params;
    const { isVerified } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.isVerified = isVerified;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${isVerified ? "verified" : "unverified"} successfully.`,
      data: {
        _id: user._id,
        name: user.name,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    Logger.error("Verify User Error", error, {
      userId: req.user?._id,
      targetUserId: req.params.userId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

/**
 * Get All Users (Admin)
 */
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all users.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { role, status, search } = req.query;

    // Build query
    const query = {};

    // Handle role filter - special case for admin to include team members
    if (role === "admin") {
      // Fetch users with role='admin' OR those who have adminRole set (team members)
      query.$or = [
        { role: "admin" },
        { adminRole: { $exists: true, $ne: null } },
      ];
    } else {
      // For regular users (buyers, sellers, dealers) - exclude admins
      // Build conditions using $and
      const conditions = [];

      // Exclude users where role is 'admin'
      conditions.push({ role: { $ne: "admin" } });

      // Exclude users with adminRole set (team members have adminRole as string)
      // Regular users have adminRole: null (default)
      // Use $in with null to match null values, or check if field doesn't exist
      conditions.push({
        $or: [{ adminRole: null }, { adminRole: { $exists: false } }],
      });

      // If specific role is requested, add it
      if (role) {
        conditions.push({ role: role });
      }

      // Combine all conditions with $and
      query.$and = conditions;
    }

    // Add status filter
    if (status) {
      if (query.$and) {
        query.$and.push({ status: status });
      } else {
        query.status = status;
      }
    }

    // Handle search - combine with existing query conditions
    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];

      if (query.$and) {
        query.$and.push({ $or: searchConditions });
      } else if (query.$or) {
        // For admin role filter, combine search with existing $or
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        // Simple case - just add search conditions
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
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    Logger.error("Get All Users Error", error, { userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Single User (Admin)
 */
export const getUserById = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view user details.",
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
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",
      data: user,
    });
  } catch (error) {
    Logger.error("Get User By ID Error", error, {
      userId: req.user?._id,
      targetUserId: req.params.userId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update User (Admin)
 */
export const updateUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update users.",
      });
    }

    const { userId } = req.params;
    const {
      name,
      role,
      status,
      boostCredits,
      subscription,
      adminRole,
      roleId,
      permissions,
    } = req.body;

    // Prevent admin from modifying themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot modify your own account through this endpoint.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Update fields
    if (name) user.name = name.trim();
    if (role && ["buyer", "seller", "admin", "dealer"].includes(role)) {
      user.role = role;
    }
    if (status && ["active", "inactive", "suspended"].includes(status)) {
      user.status = status;
    }
    if (boostCredits !== undefined) {
      user.boostCredits = Math.max(0, parseInt(boostCredits));
    }
    if (subscription) {
      if (subscription.plan) user.subscription.plan = subscription.plan;
      if (subscription.isActive !== undefined)
        user.subscription.isActive = subscription.isActive;
      if (subscription.startDate)
        user.subscription.startDate = new Date(subscription.startDate);
      if (subscription.endDate)
        user.subscription.endDate = new Date(subscription.endDate);
    }

    // Update admin role fields (for team members)
    if (adminRole !== undefined) {
      user.adminRole = adminRole;
    }
    if (roleId !== undefined) {
      // Validate roleId is a valid ObjectId
      if (roleId && !mongoose.Types.ObjectId.isValid(roleId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid roleId format.",
        });
      }
      user.roleId = roleId || null;
    }
    if (permissions !== undefined && typeof permissions === "object") {
      user.permissions = permissions;
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
        subscription: user.subscription,
      },
    });
  } catch (error) {
    Logger.error("Update User Error", error, {
      userId: req.user?._id,
      targetUserId: req.params.userId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete User (Admin)
 */
export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete users.",
      });
    }

    const { userId } = req.params;

    // Debug logging
    Logger.info("Delete user attempt", {
      userId: userId,
      userIdType: typeof userId,
      allParams: req.params,
      user: req.user._id,
    });

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      Logger.warn("User not found during deletion", {
        requestedUserId: userId,
        isValidObjectId: mongoose.Types.ObjectId.isValid(userId),
      });
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Store user info for email before deletion
    const userInfo = {
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Delete user's cars
    await Car.deleteMany({ postedBy: userId });

    // Delete user
    await user.deleteOne();

    // Send email notification to user about account deletion
    try {
      const sendEmail = (await import("../utils/sendEmail.js")).default;
      const siteName = process.env.SITE_NAME || "Sello";
      const clientUrl =
        process.env.NODE_ENV === "production"
          ? process.env.PRODUCTION_URL ||
            process.env.CLIENT_URL?.split(",")[0]?.trim()
          : process.env.CLIENT_URL?.split(",")[0]?.trim() ||
            "http://localhost:5173";

      const emailSubject = `Account Deleted - ${siteName}`;

      const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${emailSubject}</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 24px;">🚫 Account Deleted</h1>
                    </div>
                    <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p style="font-size: 16px; margin-top: 0;">Hello <strong>${userInfo.name}</strong>,</p>
                        <p style="font-size: 16px;">
                            We regret to inform you that your account on <strong>${siteName}</strong> has been permanently deleted by our administration team.
                        </p>
                        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0; font-size: 14px; color: #856404;">
                                <strong>Important Information:</strong><br>
                                • All your listings, messages, and account data have been permanently removed<br>
                                • You will no longer be able to access your account<br>
                                • This action cannot be reversed
                            </p>
                        </div>
                        <p style="font-size: 16px;">
                            If you believe this was done in error or have questions about your account deletion, please contact our support team immediately.
                        </p>
                        <div style="margin: 30px 0; text-align: center;">
                            <a href="${clientUrl}/contact" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                Contact Support
                            </a>
                        </div>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                            This is an automated notification. If you did not expect this email, please contact our support team immediately.
                        </p>
                    </div>
                </body>
                </html>
            `;

      await sendEmail(userInfo.email, emailSubject, emailHtml);
      Logger.info("Account deletion email sent successfully", {
        userId: userId,
        email: userInfo.email,
        deletedBy: req.user._id,
      });
    } catch (emailError) {
      Logger.error("Error sending account deletion email", emailError, {
        userId: userId,
        email: userInfo.email,
      });
      // Don't fail the request if email fails
    }

    Logger.info("User deleted successfully", {
      userId: userId,
      email: userInfo.email,
      name: userInfo.name,
      role: userInfo.role,
      deletedBy: req.user._id,
      deletedByName: req.user.name,
    });

    return res.status(200).json({
      success: true,
      message:
        "User and associated data deleted successfully. User has been notified via email.",
    });
  } catch (error) {
    Logger.error("Delete User Error", error, {
      userId: req.user?._id,
      targetUserId: req.params.userId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get All Cars (Admin)
 */
export const getAllCars = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all cars.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, brand, search } = req.query;

    // Build query
    const query = {};

    // Status filter: all, pending, approved, rejected, sold
    if (status && status !== "all") {
      if (status === "sold") {
        query.isSold = true;
      } else if (status === "rejected") {
        query.isApproved = false;
        query.rejectionReason = { $exists: true, $ne: null };
      } else if (status === "approved") {
        query.isApproved = true;
        query.isSold = { $ne: true };
      } else if (status === "pending") {
        // Pending: not approved, not sold, and not explicitly rejected
        query.isApproved = { $ne: true };
        query.isSold = { $ne: true };
        query.$or = [
          { rejectionReason: { $exists: false } },
          { rejectionReason: null },
        ];
      }
    }

    // Brand filter
    if (brand && brand !== "all") {
      query.make = { $regex: brand, $options: "i" };
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { make: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
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
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    Logger.error("Get All Cars (Admin) Error", error, {
      userId: req.user?._id,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Approve/Reject Car (Admin)
 */
export const approveCar = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can approve/reject cars.",
      });
    }

    const { carId } = req.params;
    const { isApproved, rejectionReason } = req.body;

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

    car.isApproved = isApproved === true || isApproved === "true";
    car.approvedBy = req.user._id;
    car.approvedAt = new Date();
    if (!car.isApproved && rejectionReason) {
      car.rejectionReason = rejectionReason;
    } else {
      car.rejectionReason = null;
    }

    await car.save();

    // Send email notification to seller
    try {
      const seller = await User.findById(car.postedBy);
      if (seller && seller.email) {
        let subject, html;

        if (car.isApproved) {
          subject = "🎉 Your Car Listing is Live! - SELLO";
          html = getCarApprovedTemplate(seller.name, car.title, car._id);
        } else {
          subject = "Listing Update - SELLO";
          html = getCarRejectedTemplate(
            seller.name,
            car.title,
            car.rejectionReason
          );
        }

        await sendEmail(seller.email, subject, html, { async: true });
        Logger.info(
          `Car ${car.isApproved ? "approval" : "rejection"} email sent to: ${
            seller.email
          }`
        );
      }
    } catch (emailError) {
      Logger.warn(
        `Failed to send car ${
          car.isApproved ? "approval" : "rejection"
        } email: ${emailError.message}`
      );
      // Don't break the approval process if email fails
    }

    return res.status(200).json({
      success: true,
      message: `Car ${car.isApproved ? "approved" : "rejected"} successfully.`,
      data: {
        _id: car._id,
        title: car.title,
        isApproved: car.isApproved,
        approvedBy: req.user.name,
        approvedAt: car.approvedAt,
        rejectionReason: car.rejectionReason,
      },
    });
  } catch (error) {
    Logger.error("Approve Car Error", error, {
      userId: req.user?._id,
      carId: req.params.carId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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

    // Delete images from Cloudinary before deleting car
    if (car.images && Array.isArray(car.images) && car.images.length > 0) {
      try {
        const { deleteCloudinaryImages } = await import(
          "../utils/cloudinary.js"
        );
        const deleteResult = await deleteCloudinaryImages(car.images);
        Logger.info("Deleted car images from Cloudinary (admin delete)", {
          carId,
          deleted: deleteResult.deleted.length,
          failed: deleteResult.failed.length,
        });

        if (deleteResult.failed.length > 0) {
          Logger.warn(
            "Some images failed to delete from Cloudinary (admin delete)",
            {
              carId,
              failed: deleteResult.failed,
            }
          );
        }
      } catch (imageError) {
        Logger.error(
          "Error deleting images from Cloudinary (admin delete)",
          imageError,
          { carId }
        );
        // Continue with deletion even if image deletion fails
      }
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
      Logger.error(
        "Failed to create listing history on admin delete",
        historyError,
        { carId }
      );
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
    Logger.error("Delete Car (Admin) Error", error, {
      userId: req.user?._id,
      carId: req.params.carId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
    Logger.error("Get Listing History Error", error, { userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Feature/Unfeature Car (Admin)
 */
export const featureCar = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can feature cars.",
      });
    }

    const { carId } = req.params;
    const { featured } = req.body;

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

    // Convert featured to boolean (same pattern as approveCar)
    const featuredValue = featured === true || featured === "true";

    // Use updateOne to avoid validation issues with required fields
    const updateResult = await Car.updateOne(
      { _id: carId },
      { $set: { featured: featuredValue } }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Car not found.",
      });
    }

    if (updateResult.modifiedCount === 0) {
      // Car was found but not modified (might already have the same value)
      // This is not an error, just informational
    }

    return res.status(200).json({
      success: true,
      message: `Car ${featuredValue ? "featured" : "unfeatured"} successfully.`,
      data: {
        _id: car._id,
        title: car.title,
        featured: featuredValue,
      },
    });
  } catch (error) {
    Logger.error("Feature Car Error", error, {
      userId: req.user?._id,
      carId: req.params.carId,
      featured: req.body.featured,
    });

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get All Dealers (Admin)
 */
export const getAllDealers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all dealers.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { verified, search } = req.query;

    // Build query
    const query = { role: "dealer" };
    if (verified !== undefined) query["isVerified"] = verified === "true";
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "dealerInfo.businessName": { $regex: search, $options: "i" } },
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
        const listingsCount = await Car.countDocuments({
          postedBy: dealer._id,
        });
        const salesCount = await Car.countDocuments({
          postedBy: dealer._id,
          isSold: true,
        });

        return {
          ...dealer.toObject(),
          listingsCount,
          salesCount,
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
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    Logger.error("Get All Dealers Error", error, { userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Verify Dealer (Admin)
 */
export const verifyDealer = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can verify dealers.",
      });
    }

    const { userId } = req.params;
    const { verified } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role !== "dealer") {
      return res.status(400).json({
        success: false,
        message: "User is not a dealer.",
      });
    }

    // Ensure dealerInfo exists
    if (!user.dealerInfo) {
      user.dealerInfo = {};
    }

    // Check if auto-approve dealers is enabled
    const Settings = (await import("../models/settingsModel.js")).default;
    const autoApproveDealersSetting = await Settings.findOne({
      key: "autoApproveDealers",
    });
    const autoApproveDealers =
      autoApproveDealersSetting &&
      (autoApproveDealersSetting.value === true ||
        autoApproveDealersSetting.value === "true" ||
        autoApproveDealersSetting.value === 1 ||
        autoApproveDealersSetting.value === "1");

    // If auto-approve is enabled and admin is trying to verify, auto-approve
    // Otherwise, use the provided verified value
    const shouldVerify = autoApproveDealers
      ? true
      : verified === true || verified === "true";

    const wasVerified = user.dealerInfo?.verified || false;
    user.dealerInfo.verified = shouldVerify;
    user.dealerInfo.verifiedAt = shouldVerify ? new Date() : null;

    await user.save();

    // Return updated user with populated dealerInfo
    await user.populate("dealerInfo");

    // Send email notification if dealer was just verified (not previously verified)
    if (shouldVerify && !wasVerified) {
      try {
        const sendEmail = (await import("../utils/sendEmail.js")).default;
        const siteName = process.env.SITE_NAME || "Sello";
        const clientUrl =
          process.env.CLIENT_URL?.split(",")[0]?.trim() ||
          "http://localhost:3000";

        const emailSubject = `🎉 Your Dealer Account is Now Verified - ${siteName}`;
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
                            <h1 style="margin: 0; font-size: 24px;">🎉 Dealer Account Verified!</h1>
                        </div>
                        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 16px; margin-top: 0;">Hello <strong>${
                              user.name
                            }</strong>,</p>
                            <p style="font-size: 16px;">
                                Great news! Your dealer account for <strong>${
                                  user.dealerInfo?.businessName ||
                                  "your business"
                                }</strong> has been verified by our admin team.
                            </p>
                            <p style="font-size: 16px;">
                                As a verified dealer, you now have access to:
                            </p>
                            <ul style="font-size: 15px; line-height: 2;">
                                <li>✅ Dealer dashboard with advanced analytics</li>
                                <li>✅ Priority listing placement</li>
                                <li>✅ Enhanced visibility in search results</li>
                                <li>✅ Access to dealer-specific features</li>
                            </ul>
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="${clientUrl}/dealer-dashboard" style="background-color: #FFA602; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                    Go to Dealer Dashboard
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
        Logger.error("Error sending dealer verification email", emailError, {
          userId: user._id,
          email: user.email,
        });
        // Don't fail the verification if email fails
      }
    }

    return res.status(200).json({
      success: true,
      message: `Dealer ${
        user.dealerInfo.verified ? "verified" : "unverified"
      } successfully.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        dealerInfo: user.dealerInfo,
      },
    });
  } catch (error) {
    Logger.error("Verify Dealer Error", error, {
      userId: req.user?._id,
      targetUserId: req.params.userId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Audit Logs (Admin)
 */
export const getAuditLogsController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view audit logs.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { actor, target, action, dateFrom, dateTo } = req.query;

    // Build filters
    const filters = {};
    if (actor) {
      filters.actor = mongoose.Types.ObjectId.isValid(actor) ? actor : null;
    }
    if (target) {
      filters.target = mongoose.Types.ObjectId.isValid(target) ? target : null;
    }
    if (action) {
      filters.action = action;
    }
    if (dateFrom || dateTo) {
      filters.timestamp = {};
      if (dateFrom) {
        filters.timestamp.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filters.timestamp.$lte = new Date(dateTo);
      }
    }

    const result = await getAuditLogs(filters, page, limit);

    return res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully.",
      data: {
        logs: result.logs,
        pagination: {
          page: result.page,
          pages: result.pages,
          total: result.total,
          limit,
        },
      },
    });
  } catch (error) {
    Logger.error("Get Audit Logs Error", error, { userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
