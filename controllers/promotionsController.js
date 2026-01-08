import Promotion from "../models/promotionModel.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import sendEmail from "../utils/sendEmail.js";

/**
 * Create Promotion
 */
export const createPromotion = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create promotions.",
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
      maxDiscountAmount,
    } = req.body;

    // Validation
    if (
      !title ||
      !promoCode ||
      !discountType ||
      !discountValue ||
      !usageLimit ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date.",
      });
    }

    if (end < new Date()) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be in the past.",
      });
    }

    // Validate discount value
    if (
      discountType === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100.",
      });
    }

    if (discountType === "fixed" && discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount must be greater than 0.",
      });
    }

    // Check if promo code already exists
    const existingPromotion = await Promotion.findOne({
      promoCode: promoCode.toUpperCase().trim(),
    });

    if (existingPromotion) {
      return res.status(409).json({
        success: false,
        message: "Promo code already exists. Please use a different code.",
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
      maxDiscountAmount: maxDiscountAmount
        ? parseFloat(maxDiscountAmount)
        : null,
      createdBy: req.user._id,
    });

    // Send email notifications and create in-app notifications
    await sendPromotionNotifications(promotion, req.user);

    return res.status(201).json({
      success: true,
      message: "Promotion created successfully and notifications sent.",
      data: promotion,
    });
  } catch (error) {
    console.error("Create Promotion Error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Promo code already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get All Promotions
 */
export const getAllPromotions = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all promotions.",
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
        { title: { $regex: search, $options: "i" } },
        { promoCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
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
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
    });

    const expiredPromotions = await Promotion.countDocuments({
      $or: [{ status: "expired" }, { endDate: { $lt: new Date() } }],
    });

    return res.status(200).json({
      success: true,
      message: "Promotions retrieved successfully.",
      data: {
        promotions,
        statistics: {
          total,
          active: activePromotions,
          expired: expiredPromotions,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get All Promotions Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Single Promotion
 */
export const getPromotionById = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view promotions.",
      });
    }

    const { promotionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion ID.",
      });
    }

    const promotion = await Promotion.findById(promotionId).populate(
      "createdBy",
      "name email"
    );

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Promotion retrieved successfully.",
      data: promotion,
    });
  } catch (error) {
    console.error("Get Promotion Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update Promotion
 */
export const updatePromotion = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update promotions.",
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
      maxDiscountAmount,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion ID.",
      });
    }

    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found.",
      });
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date.",
        });
      }
    }

    // Check if promo code is being changed and if it already exists
    if (promoCode && promoCode.toUpperCase().trim() !== promotion.promoCode) {
      const existingPromotion = await Promotion.findOne({
        promoCode: promoCode.toUpperCase().trim(),
        _id: { $ne: promotionId },
      });

      if (existingPromotion) {
        return res.status(409).json({
          success: false,
          message: "Promo code already exists. Please use a different code.",
        });
      }
    }

    // Update fields
    if (title) promotion.title = title.trim();
    if (description !== undefined) promotion.description = description;
    if (promoCode) promotion.promoCode = promoCode.toUpperCase().trim();
    if (discountType) promotion.discountType = discountType;
    if (discountValue !== undefined)
      promotion.discountValue = parseFloat(discountValue);
    if (usageLimit !== undefined) promotion.usageLimit = parseInt(usageLimit);
    if (startDate) promotion.startDate = new Date(startDate);
    if (endDate) promotion.endDate = new Date(endDate);
    if (targetAudience) promotion.targetAudience = targetAudience;
    if (status) promotion.status = status;
    if (minPurchaseAmount !== undefined)
      promotion.minPurchaseAmount = parseFloat(minPurchaseAmount);
    if (maxDiscountAmount !== undefined)
      promotion.maxDiscountAmount = maxDiscountAmount
        ? parseFloat(maxDiscountAmount)
        : null;

    // Auto-update status based on dates
    const now = new Date();
    if (promotion.endDate < now) {
      promotion.status = "expired";
    }

    await promotion.save();

    return res.status(200).json({
      success: true,
      message: "Promotion updated successfully.",
      data: promotion,
    });
  } catch (error) {
    console.error("Update Promotion Error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Promo code already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete Promotion
 */
export const deletePromotion = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete promotions.",
      });
    }

    const { promotionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion ID.",
      });
    }

    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found.",
      });
    }

    await promotion.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Promotion deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Promotion Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Promotion Statistics
 */
export const getPromotionStats = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view promotion statistics.",
      });
    }

    const [
      totalPromotions,
      activePromotions,
      expiredPromotions,
      todayPromotions,
    ] = await Promise.all([
      Promotion.countDocuments({}),
      Promotion.countDocuments({
        status: "active",
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        $expr: { $lt: ["$usedCount", "$usageLimit"] },
      }),
      Promotion.countDocuments({
        $or: [{ status: "expired" }, { endDate: { $lt: new Date() } }],
      }),
      Promotion.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    // Get total usage across all promotions
    const totalUsage = await Promotion.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$usedCount" },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Promotion statistics retrieved successfully.",
      data: {
        promotions: {
          total: totalPromotions,
          active: activePromotions,
          expired: expiredPromotions,
          today: todayPromotions,
        },
        usage: {
          total: totalUsage[0]?.total || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get Promotion Stats Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message: "Promo code is required.",
      });
    }

    const promotion = await Promotion.findOne({
      promoCode: promoCode.toUpperCase().trim(),
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Invalid promo code.",
      });
    }

    // Check if promotion can be used
    if (!promotion.canBeUsed()) {
      return res.status(400).json({
        success: false,
        message: "This promo code is no longer valid.",
      });
    }

    // Check minimum purchase amount
    if (
      amount &&
      promotion.minPurchaseAmount > 0 &&
      amount < promotion.minPurchaseAmount
    ) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount of $${promotion.minPurchaseAmount} required.`,
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
          maxDiscountAmount: promotion.maxDiscountAmount,
        },
        discount,
      },
    });
  } catch (error) {
    console.error("Validate Promo Code Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Active Promotions (Public endpoint for users)
 */
export const getActivePromotions = async (req, res) => {
  try {
    const now = new Date();
    const promotions = await Promotion.find({
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
      isActive: true,
    })
      .select(
        "title description promoCode discountType discountValue minPurchaseAmount maxDiscountAmount startDate endDate usageLimit usedCount"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Active promotions retrieved successfully.",
      data: promotions,
    });
  } catch (error) {
    console.error("Get Active Promotions Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Send Promotion Notifications (Email + In-App)
 */
const sendPromotionNotifications = async (promotion, adminUser) => {
  try {
    // Starting notification process for promotion

    // Get target users based on promotion targetAudience
    let targetUsers = [];
    const siteName = process.env.SITE_NAME || "Sello";
    const clientUrl =
      process.env.NODE_ENV === "production"
        ? process.env.PRODUCTION_URL ||
          process.env.CLIENT_URL?.split(",")[0]?.trim()
        : process.env.CLIENT_URL?.split(",")[0]?.trim() ||
          "http://localhost:5173";

    // Determine user query based on targetAudience
    let userQuery = { role: { $ne: "admin" } }; // Default: all non-admin users

    if (promotion.targetAudience === "buyers") {
      userQuery = { role: "individual" };
    } else if (promotion.targetAudience === "sellers") {
      userQuery = { role: "individual" };
    } else if (promotion.targetAudience === "dealers") {
      userQuery = { role: "dealer" };
    }

    // Only get active/verified users for better deliverability
    targetUsers = await User.find(userQuery)
      .select("_id email name verified status")
      .limit(1000); // Limit to prevent overwhelming

    // Found users to notify for target audience

    if (targetUsers.length === 0) {
      // No users found for target audience
      return;
    }

    // Create in-app notifications
    const notificationPromises = targetUsers.map(async (user) => {
      try {
        const notification = await Notification.create({
          title: `🎉 New Promotion: ${promotion.title}`,
          message: `Use code ${promotion.promoCode} to get ${
            promotion.discountType === "percentage"
              ? promotion.discountValue + "%"
              : "$" + promotion.discountValue
          } off!${
            promotion.minPurchaseAmount > 0
              ? ` Minimum purchase: $${promotion.minPurchaseAmount}`
              : ""
          }`,
          type: "promotion",
          recipient: user._id,
          targetRole: null,
          actionUrl: `/promotions/${promotion._id}`,
          actionText: "View Promotion",
          createdBy: adminUser._id,
          expiresAt: promotion.endDate,
        });
        return notification;
      } catch (error) {
        console.error(
          `[Promotion] Failed to create notification for user ${user._id}:`,
          error.message
        );
        return null;
      }
    });

    const notifications = await Promise.all(notificationPromises);
    const successfulNotifications = notifications.filter((n) => n !== null);
    // Created in-app notifications

    // Send email notifications if enabled
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === "true") {
      // Sending email notifications to users

      const emailPromises = targetUsers.map(async (user) => {
        if (!user.email || !user.verified) {
          return null; // Skip unverified users or users without email
        }

        try {
          const subject = `🎉 Exclusive Promotion: ${promotion.title}`;
          const discountText =
            promotion.discountType === "percentage"
              ? `${promotion.discountValue}% OFF`
              : `$${promotion.discountValue} OFF`;

          const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎉 Limited Time Offer!</h1>
                <p style="margin: 10px 0 0; font-size: 18px; opacity: 0.9;">Exclusive Promotion Just for You</p>
              </div>
              
              <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #111827; margin: 0 0 10px; font-size: 24px;">${
                  promotion.title
                }</h2>
                
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                  <p style="margin: 0; font-size: 16px; color: #374151;">
                    ${
                      promotion.description ||
                      "Get amazing discounts on your next purchase!"
                    }
                  </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <div style="display: inline-block; background: #fef3c7; padding: 20px; border-radius: 8px; border: 2px dashed #f59e0b;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Your Promo Code</p>
                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 2px;">${
                      promotion.promoCode
                    }</p>
                  </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px;">
                  <div>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Discount</p>
                    <p style="margin: 5px 0 0; font-size: 20px; font-weight: bold; color: #059669;">${discountText}</p>
                  </div>
                  ${
                    promotion.minPurchaseAmount > 0
                      ? `
                  <div>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Min Purchase</p>
                    <p style="margin: 5px 0 0; font-size: 20px; font-weight: bold; color: #7c3aed;">$${promotion.minPurchaseAmount}</p>
                  </div>
                  `
                      : ""
                  }
                  <div>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Valid Until</p>
                    <p style="margin: 5px 0 0; font-size: 16px; font-weight: bold; color: #dc2626;">${new Date(
                      promotion.endDate
                    ).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${clientUrl}" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
                    Shop Now & Save
                  </a>
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                    This offer expires on ${new Date(
                      promotion.endDate
                    ).toLocaleDateString()}. 
                    ${
                      promotion.usageLimit
                        ? `Limited to ${promotion.usageLimit} uses.`
                        : ""
                    }
                  </p>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #6b7280; text-align: center;">
                    You received this because you have an account on ${siteName}.
                  </p>
                </div>
              </div>
            </div>
          `;

          await sendEmail(user.email, subject, html);
          // Email sent successfully
          return { success: true, email: user.email };
        } catch (emailError) {
          console.error(
            `[Promotion] Failed to send email to ${user.email}:`,
            emailError.message
          );
          return {
            success: false,
            email: user.email,
            error: emailError.message,
          };
        }
      });

      const emailResults = await Promise.all(emailPromises);
      const successfulEmails = emailResults.filter((r) => r && r.success);
      // Sent emails successfully
    } else {
      // Email notifications disabled
    }

    // Emit real-time notifications via socket.io
    try {
      const io = global.io || require("../server").io;
      if (io && successfulNotifications.length > 0) {
        const socketData = {
          _id: promotion._id,
          title: `🎉 New Promotion: ${promotion.title}`,
          message: `Use code ${promotion.promoCode} to get ${
            promotion.discountType === "percentage"
              ? promotion.discountValue + "%"
              : "$" + promotion.discountValue
          } off!`,
          type: "promotion",
          actionUrl: `/promotions/${promotion._id}`,
          actionText: "View Promotion",
          createdAt: new Date(),
        };

        // Send to all users based on target audience
        if (promotion.targetAudience === "all") {
          io.emit("new-notification", socketData);
        } else if (promotion.targetAudience === "dealers") {
          io.to("role:dealer").emit("new-notification", socketData);
        } else if (
          promotion.targetAudience === "buyers" ||
          promotion.targetAudience === "sellers"
        ) {
          io.to("role:individual").emit("new-notification", socketData);
        }

        // Real-time notifications sent via socket.io
      }
    } catch (socketError) {
      console.error(`[Promotion] Socket.io error:`, socketError.message);
    }

    // Notification process completed
  } catch (error) {
    console.error("[Promotion] Error in sendPromotionNotifications:", error);
  }
};
