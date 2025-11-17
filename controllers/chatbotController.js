import mongoose from 'mongoose';
import { Chat, Message } from '../models/chatModel.js';
import QuickReply from '../models/quickReplyModel.js';

/**
 * Chatbot Controller
 * Handles chatbot configuration, statistics, and quick replies
 */

/**
 * Get Chatbot Configuration
 */
export const getChatbotConfig = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can access chatbot configuration."
            });
        }

        // Placeholder configuration
        const config = {
            enabled: true,
            welcomeMessage: "Welcome to SELLO! How can I help you today?",
            autoResponse: true,
            workingHours: {
                enabled: false,
                start: "09:00",
                end: "18:00",
                timezone: "UTC"
            },
            responses: {
                greeting: "Hello! Welcome to SELLO. I'm here to help you find the perfect car.",
                help: "I can help you with car listings, pricing, and general inquiries.",
                default: "I'm sorry, I didn't understand that. Could you please rephrase?"
            }
        };

        return res.status(200).json({
            success: true,
            message: "Chatbot configuration retrieved successfully.",
            data: config
        });
    } catch (error) {
        console.error("Get Chatbot Config Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Chatbot Configuration
 */
export const updateChatbotConfig = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update chatbot configuration."
            });
        }

        const { enabled, welcomeMessage, autoResponse, workingHours, responses } = req.body;

        // In a real implementation, this would save to database
        // For now, just return success
        const config = {
            enabled: enabled !== undefined ? enabled : true,
            welcomeMessage: welcomeMessage || "Welcome to SELLO! How can I help you today?",
            autoResponse: autoResponse !== undefined ? autoResponse : true,
            workingHours: workingHours || {
                enabled: false,
                start: "09:00",
                end: "18:00",
                timezone: "UTC"
            },
            responses: responses || {
                greeting: "Hello! Welcome to SELLO. I'm here to help you find the perfect car.",
                help: "I can help you with car listings, pricing, and general inquiries.",
                default: "I'm sorry, I didn't understand that. Could you please rephrase?"
            },
            updatedAt: new Date(),
            updatedBy: req.user._id
        };

        return res.status(200).json({
            success: true,
            message: "Chatbot configuration updated successfully.",
            data: config
        });
    } catch (error) {
        console.error("Update Chatbot Config Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Chatbot Statistics
 */
export const getChatbotStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view chatbot statistics."
            });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Get support chat statistics
        const [
            totalSupportChats,
            activeChats,
            pendingChats,
            resolvedChats,
            unresolvedChats,
            botMessages
        ] = await Promise.all([
            Chat.countDocuments({ chatType: 'support' }),
            Chat.countDocuments({ chatType: 'support', status: 'open' }),
            Chat.countDocuments({ chatType: 'support', status: 'open', priority: { $in: ['high', 'urgent'] } }),
            Chat.countDocuments({ chatType: 'support', status: 'resolved' }),
            Chat.countDocuments({ chatType: 'support', status: 'open', priority: { $nin: ['urgent', 'high'] } }),
            Message.countDocuments({ isBot: true })
        ]);

        const stats = {
            activeChats,
            pending: pendingChats,
            resolved: resolvedChats,
            unresolved: unresolvedChats,
            totalConversations: totalSupportChats,
            totalMessages: botMessages
        };

        return res.status(200).json({
            success: true,
            message: "Chatbot statistics retrieved successfully.",
            data: stats
        });
    } catch (error) {
        console.error("Get Chatbot Stats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Quick Replies
 */
export const getQuickReplies = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view quick replies."
            });
        }

        const { category, isActive } = req.query;
        const query = {};
        if (category) query.category = category;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const quickReplies = await QuickReply.find(query)
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Quick replies retrieved successfully.",
            data: quickReplies
        });
    } catch (error) {
        console.error("Get Quick Replies Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create Quick Reply
 */
export const createQuickReply = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create quick replies."
            });
        }

        const { title, message, category } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required."
            });
        }

        const quickReply = await QuickReply.create({
            title,
            message,
            category: category || 'general',
            createdBy: req.user._id
        });

        const populated = await QuickReply.findById(quickReply._id)
            .populate("createdBy", "name email");

        return res.status(201).json({
            success: true,
            message: "Quick reply created successfully.",
            data: populated
        });
    } catch (error) {
        console.error("Create Quick Reply Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Quick Reply
 */
export const updateQuickReply = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update quick replies."
            });
        }

        const { replyId } = req.params;
        const { title, message, category, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(replyId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid quick reply ID."
            });
        }

        const quickReply = await QuickReply.findById(replyId);
        if (!quickReply) {
            return res.status(404).json({
                success: false,
                message: "Quick reply not found."
            });
        }

        if (title) quickReply.title = title;
        if (message) quickReply.message = message;
        if (category) quickReply.category = category;
        if (isActive !== undefined) quickReply.isActive = isActive;

        await quickReply.save();

        const populated = await QuickReply.findById(quickReply._id)
            .populate("createdBy", "name email");

        return res.status(200).json({
            success: true,
            message: "Quick reply updated successfully.",
            data: populated
        });
    } catch (error) {
        console.error("Update Quick Reply Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Quick Reply
 */
export const deleteQuickReply = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete quick replies."
            });
        }

        const { replyId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(replyId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid quick reply ID."
            });
        }

        const quickReply = await QuickReply.findByIdAndDelete(replyId);
        if (!quickReply) {
            return res.status(404).json({
                success: false,
                message: "Quick reply not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Quick reply deleted successfully."
        });
    } catch (error) {
        console.error("Delete Quick Reply Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Use Quick Reply (increment usage count)
 */
export const useQuickReply = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can use quick replies."
            });
        }

        const { replyId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(replyId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid quick reply ID."
            });
        }

        const quickReply = await QuickReply.findById(replyId);
        if (!quickReply) {
            return res.status(404).json({
                success: false,
                message: "Quick reply not found."
            });
        }

        quickReply.usageCount = (quickReply.usageCount || 0) + 1;
        await quickReply.save();

        return res.status(200).json({
            success: true,
            message: "Quick reply used successfully.",
            data: quickReply
        });
    } catch (error) {
        console.error("Use Quick Reply Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

