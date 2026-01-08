import AccountDeletionRequest from "../models/accountDeletionRequestModel.js";
import User from "../models/userModel.js";
import Car from "../models/carModel.js";
import Logger from "../utils/logger.js";
import Notification from "../models/notificationModel.js";
import sendEmail from "../utils/sendEmail.js";
import {
  getAccountDeletionApprovedTemplate,
  getAccountDeletionRejectedTemplate,
} from "../utils/emailTemplates.js";

/**
 * Create account deletion request
 */
export const createDeletionRequest = async (req, res) => {
  try {
    const { reason, additionalComments } = req.body;

    // Check if user already has a pending deletion request
    const existingRequest = await AccountDeletionRequest.findOne({
      user: req.user._id,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending deletion request.",
      });
    }

    // Create new deletion request
    const deletionRequest = await AccountDeletionRequest.create({
      user: req.user._id,
      reason,
      additionalComments,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Populate user info for response
    await deletionRequest.populate("user", "name email role");

    Logger.info("Account deletion request created", {
      requestId: deletionRequest._id,
      userId: req.user._id,
      reason,
    });

    return res.status(201).json({
      success: true,
      message:
        "Account deletion request submitted successfully. Your request is now pending admin review.",
      data: {
        id: deletionRequest._id,
        status: deletionRequest.status,
        createdAt: deletionRequest.createdAt,
      },
    });
  } catch (error) {
    Logger.error("Create deletion request error", error, {
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
 * Get user's deletion request status
 */
export const getDeletionRequestStatus = async (req, res) => {
  try {
    const deletionRequest = await AccountDeletionRequest.findOne({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate("reviewedBy", "name");

    if (!deletionRequest) {
      return res.status(404).json({
        success: false,
        message: "No deletion request found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Deletion request status retrieved successfully.",
      data: {
        id: deletionRequest._id,
        status: deletionRequest.status,
        reason: deletionRequest.reason,
        createdAt: deletionRequest.createdAt,
        reviewedAt: deletionRequest.reviewedAt,
        reviewedBy: deletionRequest.reviewedBy,
        reviewNotes: deletionRequest.reviewNotes,
        processedAt: deletionRequest.processedAt,
      },
    });
  } catch (error) {
    Logger.error("Get deletion request status error", error, {
      userId: req.user?._id,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

/**
 * Get all deletion requests (Admin only)
 */
export const getAllDeletionRequests = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view deletion requests.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    // Build query
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    // Handle search
    if (search) {
      query.$or = [
        { "user.name": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
      ];
    }

    const deletionRequests = await AccountDeletionRequest.find(query)
      .populate("user", "name email role status createdAt")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AccountDeletionRequest.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Deletion requests retrieved successfully.",
      data: {
        requests: deletionRequests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    Logger.error("Get all deletion requests error", error, {
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
 * Approve/Reject deletion request (Admin only)
 */
export const reviewDeletionRequest = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can review deletion requests.",
      });
    }

    const { requestId } = req.params;
    const { status, reviewNotes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'.",
      });
    }

    const deletionRequest = await AccountDeletionRequest.findById(
      requestId
    ).populate("user");

    if (!deletionRequest) {
      return res.status(404).json({
        success: false,
        message: "Deletion request not found.",
      });
    }

    if (deletionRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This request has already been processed.",
      });
    }

    // Update request status
    deletionRequest.status = status;
    deletionRequest.reviewedBy = req.user._id;
    deletionRequest.reviewedAt = new Date();
    deletionRequest.reviewNotes = reviewNotes;

    if (status === "approved") {
      // If approved, proceed with account deletion
      await deleteUserAccount(deletionRequest.user._id);
      deletionRequest.processedAt = new Date();

      Logger.info("Account deletion approved and executed", {
        requestId: deletionRequest._id,
        userId: deletionRequest.user._id,
        reviewedBy: req.user._id,
      });
    } else {
      Logger.info("Account deletion request rejected", {
        requestId: deletionRequest._id,
        userId: deletionRequest.user._id,
        reviewedBy: req.user._id,
        reviewNotes,
      });
    }

    await deletionRequest.save();

    // Send email notification to user
    try {
      const emailTemplate =
        status === "approved"
          ? getAccountDeletionApprovedTemplate(deletionRequest.user.name)
          : getAccountDeletionRejectedTemplate(
              deletionRequest.user.name,
              reviewNotes
            );

      const emailSubject =
        status === "approved"
          ? "Account Deletion Approved - SELLO"
          : "Account Deletion Request Rejected - SELLO";

      await sendEmail(deletionRequest.user.email, emailSubject, emailTemplate);

      Logger.info("Account deletion email sent successfully", {
        requestId: deletionRequest._id,
        userId: deletionRequest.user._id,
        userEmail: deletionRequest.user.email,
        action: status,
      });
    } catch (emailError) {
      Logger.error("Failed to send account deletion email", emailError, {
        requestId: deletionRequest._id,
        userId: deletionRequest.user._id,
        userEmail: deletionRequest.user.email,
      });
      // Continue even if email fails
    }

    // Create notification for the user about admin action
    try {
      const notificationTitle =
        status === "approved"
          ? "Account Deletion Approved"
          : "Account Deletion Request Rejected";

      const notificationMessage =
        status === "approved"
          ? `Your account deletion request has been approved and will be processed shortly. Your account and all associated data will be permanently deleted.`
          : `Your account deletion request has been reviewed and rejected. ${
              reviewNotes
                ? `Reason: ${reviewNotes}`
                : "You may submit a new request if needed."
            }`;

      await Notification.create({
        title: notificationTitle,
        message: notificationMessage,
        type: status === "approved" ? "error" : "warning",
        recipient: deletionRequest.user._id,
        actionUrl: "/profile",
        actionText: "View Profile",
        createdBy: req.user._id,
      });

      Logger.info("Notification created for deletion request action", {
        requestId: deletionRequest._id,
        userId: deletionRequest.user._id,
        action: status,
      });

      // Emit real-time notification via socket.io
      try {
        const io = req.app.get("io");
        if (io) {
          const socketNotificationData = {
            _id: deletionRequest._id,
            title: notificationTitle,
            message: notificationMessage,
            type: status === "approved" ? "error" : "warning",
            actionUrl: "/profile",
            actionText: "View Profile",
            createdAt: new Date(),
          };

          // Send to specific user
          io.to(`user:${deletionRequest.user._id}`).emit(
            "new-notification",
            socketNotificationData
          );
        }
      } catch (socketError) {
        Logger.error(
          "Error emitting deletion request notification via socket",
          socketError,
          {
            requestId: deletionRequest._id,
            userId: deletionRequest.user._id,
          }
        );
      }
    } catch (notificationError) {
      Logger.error(
        "Failed to create notification for deletion request",
        notificationError,
        {
          requestId: deletionRequest._id,
          userId: deletionRequest.user._id,
        }
      );
      // Continue even if notification fails
    }

    return res.status(200).json({
      success: true,
      message: `Deletion request ${status} successfully.`,
      data: {
        id: deletionRequest._id,
        status: deletionRequest.status,
        reviewedAt: deletionRequest.reviewedAt,
        reviewedBy: req.user.name,
        reviewNotes: deletionRequest.reviewNotes,
      },
    });
  } catch (error) {
    Logger.error("Review deletion request error", error, {
      userId: req.user?._id,
      requestId: req.params.requestId,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Helper function to delete user account and associated data
 */
export const deleteUserAccount = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Delete user's cars
    await Car.deleteMany({ postedBy: userId });

    // Delete the user
    await User.findByIdAndDelete(userId);

    Logger.info("User account deleted successfully", { userId });
  } catch (error) {
    Logger.error("Error deleting user account", error, { userId });
    throw error;
  }
};

/**
 * Get deletion request statistics (Admin only)
 */
export const getDeletionRequestStats = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view deletion request statistics.",
      });
    }

    const stats = await AccountDeletionRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };

    stats.forEach((stat) => {
      statsMap[stat._id] = stat.count;
    });

    // Get recent requests
    const recentRequests = await AccountDeletionRequest.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      message: "Deletion request statistics retrieved successfully.",
      data: {
        stats: statsMap,
        recentRequests,
      },
    });
  } catch (error) {
    Logger.error("Get deletion request stats error", error, {
      userId: req.user?._id,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};
