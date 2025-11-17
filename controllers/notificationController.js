import Notification from '../models/notificationModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Create Notification
 */
export const createNotification = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create notifications."
            });
        }

        const { title, message, type, recipient, actionUrl, actionText, expiresAt } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required."
            });
        }

        const notification = await Notification.create({
            title: title.trim(),
            message,
            type: type || "info",
            recipient: recipient || null, // null = broadcast
            actionUrl: actionUrl || null,
            actionText: actionText || null,
            createdBy: req.user._id,
            expiresAt: expiresAt ? new Date(expiresAt) : null
        });

        return res.status(201).json({
            success: true,
            message: "Notification created successfully.",
            data: notification
        });
    } catch (error) {
        console.error("Create Notification Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Notifications (Admin)
 */
export const getAllNotifications = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all notifications."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { type, recipient, isRead } = req.query;

        const query = {};
        if (type) query.type = type;
        if (recipient) query.recipient = recipient;
        if (isRead !== undefined) query.isRead = isRead === 'true';

        const notifications = await Notification.find(query)
            .populate("recipient", "name email")
            .populate("createdBy", "name email")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Notification.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Notifications retrieved successfully.",
            data: {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Notifications Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get User Notifications
 */
export const getUserNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { isRead } = req.query;

        const query = {
            $or: [
                { recipient: req.user._id },
                { recipient: null } // Broadcast notifications
            ]
        };

        if (isRead !== undefined) query.isRead = isRead === 'true';

        // Filter expired notifications
        query.$or.push({ expiresAt: null });
        query.$or.push({ expiresAt: { $gt: new Date() } });

        const notifications = await Notification.find(query)
            .populate("createdBy", "name")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            ...query,
            isRead: false
        });

        return res.status(200).json({
            success: true,
            message: "Notifications retrieved successfully.",
            data: {
                notifications,
                unreadCount,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get User Notifications Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Mark Notification as Read
 */
export const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID."
            });
        }

        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        // Check if user has access to this notification
        if (notification.recipient && notification.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this notification."
            });
        }

        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();

        return res.status(200).json({
            success: true,
            message: "Notification marked as read.",
            data: notification
        });
    } catch (error) {
        console.error("Mark Notification Read Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Mark All as Read
 */
export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                $or: [
                    { recipient: req.user._id },
                    { recipient: null }
                ],
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read."
        });
    } catch (error) {
        console.error("Mark All Read Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Notification
 */
export const deleteNotification = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete notifications."
            });
        }

        const { notificationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID."
            });
        }

        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        await notification.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully."
        });
    } catch (error) {
        console.error("Delete Notification Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

