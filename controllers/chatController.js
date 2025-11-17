import { Chat, Message } from '../models/chatModel.js';
import User from '../models/userModel.js';
import Car from '../models/carModel.js';
import mongoose from 'mongoose';

/**
 * Get All Chats (Admin - Chat Monitoring)
 */
export const getAllChats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can monitor chats."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { reported, isActive, search } = req.query;

        const query = {};
        if (reported !== undefined) query.reported = reported === 'true';
        if (isActive !== undefined) query.isActive = isActive === 'true';

        let chats = await Chat.find(query)
            .populate("participants", "name email avatar role")
            .populate("car", "title make model price images")
            .skip(skip)
            .limit(limit)
            .sort({ lastMessageAt: -1 });

        // Filter by search if provided
        if (search) {
            chats = chats.filter(chat => {
                const participantNames = chat.participants.map(p => p.name).join(' ');
                const carTitle = chat.car ? chat.car.title : '';
                return participantNames.toLowerCase().includes(search.toLowerCase()) ||
                       carTitle.toLowerCase().includes(search.toLowerCase());
            });
        }

        const total = await Chat.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Chats retrieved successfully.",
            data: {
                chats,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Chats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Chat Messages (Admin)
 */
export const getChatMessages = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view chat messages."
            });
        }

        const { chatId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID."
            });
        }

        const messages = await Message.find({ chat: chatId, isDeleted: false })
            .populate("sender", "name email avatar")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Message.countDocuments({ chat: chatId, isDeleted: false });

        return res.status(200).json({
            success: true,
            message: "Chat messages retrieved successfully.",
            data: {
                messages: messages.reverse(), // Reverse to show oldest first
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get Chat Messages Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Report Chat
 */
export const reportChat = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can report chats."
            });
        }

        const { chatId } = req.params;
        const { reportedReason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID."
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });
        }

        chat.reported = true;
        chat.reportedReason = reportedReason || "Reported by admin";
        chat.reportedBy = req.user._id;
        await chat.save();

        return res.status(200).json({
            success: true,
            message: "Chat reported successfully.",
            data: chat
        });
    } catch (error) {
        console.error("Report Chat Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Chat (Admin)
 */
export const deleteChat = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete chats."
            });
        }

        const { chatId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID."
            });
        }

        // Delete all messages in the chat
        await Message.deleteMany({ chat: chatId });

        // Delete the chat
        await Chat.findByIdAndDelete(chatId);

        return res.status(200).json({
            success: true,
            message: "Chat and all messages deleted successfully."
        });
    } catch (error) {
        console.error("Delete Chat Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send Message in Chat (Admin)
 */
export const sendChatMessage = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can send messages in monitored chats."
            });
        }

        const { chatId } = req.params;
        const { message, messageType = 'text' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message is required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID."
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });
        }

        // Add admin to participants if not already there
        if (!chat.participants.includes(req.user._id)) {
            chat.participants.push(req.user._id);
        }

        // Create message
        const newMessage = await Message.create({
            chat: chatId,
            sender: req.user._id,
            message: message.trim(),
            messageType,
            isBot: false
        });

        // Update chat
        chat.lastMessage = message.trim();
        chat.lastMessageAt = new Date();
        chat.isActive = true;

        // Update unread count for other participants
        chat.participants.forEach(participantId => {
            if (participantId.toString() !== req.user._id.toString()) {
                const currentUnread = chat.unreadCount.get(participantId.toString()) || 0;
                chat.unreadCount.set(participantId.toString(), currentUnread + 1);
            }
        });

        await chat.save();

        const populatedMessage = await Message.findById(newMessage._id)
            .populate("sender", "name email avatar role");

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${chatId}`).emit('new-message', {
                message: populatedMessage,
                chat: chat,
                chatId: chatId
            });
        }

        return res.status(201).json({
            success: true,
            message: "Message sent successfully.",
            data: populatedMessage
        });
    } catch (error) {
        console.error("Send Chat Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Message (Admin)
 */
export const deleteMessage = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete messages."
            });
        }

        const { messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid message ID."
            });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found."
            });
        }

        // Soft delete
        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${message.chat}`).emit('message-deleted', {
                messageId: message._id,
                chatId: message.chat
            });
        }

        return res.status(200).json({
            success: true,
            message: "Message deleted successfully."
        });
    } catch (error) {
        console.error("Delete Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Edit Message (Admin)
 */
export const editMessage = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can edit messages."
            });
        }

        const { messageId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message is required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid message ID."
            });
        }

        const messageDoc = await Message.findById(messageId);
        if (!messageDoc) {
            return res.status(404).json({
                success: false,
                message: "Message not found."
            });
        }

        // Update message
        messageDoc.message = message.trim();
        messageDoc.editedAt = new Date();
        messageDoc.isEdited = true;
        await messageDoc.save();

        const populatedMessage = await Message.findById(messageDoc._id)
            .populate("sender", "name email avatar role");

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${messageDoc.chat}`).emit('message-updated', {
                message: populatedMessage,
                chatId: messageDoc.chat
            });
        }

        return res.status(200).json({
            success: true,
            message: "Message updated successfully.",
            data: populatedMessage
        });
    } catch (error) {
        console.error("Edit Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Chat Statistics
 */
export const getChatStatistics = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view chat statistics."
            });
        }

        const [
            totalChats,
            activeChats,
            reportedChats,
            totalMessages,
            todayMessages
        ] = await Promise.all([
            Chat.countDocuments(),
            Chat.countDocuments({ isActive: true }),
            Chat.countDocuments({ reported: true }),
            Message.countDocuments({ isDeleted: false }),
            Message.countDocuments({
                isDeleted: false,
                createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Chat statistics retrieved successfully.",
            data: {
                totalChats,
                activeChats,
                reportedChats,
                totalMessages,
                todayMessages
            }
        });
    } catch (error) {
        console.error("Get Chat Statistics Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Messages (Admin - for monitoring)
 */
export const getAllMessages = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all messages."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const { search, chatId } = req.query;

        const query = { isDeleted: false };
        if (chatId) query.chat = chatId;

        let messages = await Message.find(query)
            .populate("sender", "name email avatar role")
            .populate({
                path: "chat",
                populate: {
                    path: "participants",
                    select: "name email avatar role"
                }
            })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Filter by search if provided
        if (search) {
            messages = messages.filter(msg => {
                const senderName = msg.sender?.name || "";
                const messageText = msg.message || "";
                const searchLower = search.toLowerCase();
                return senderName.toLowerCase().includes(searchLower) ||
                       messageText.toLowerCase().includes(searchLower) ||
                       msg._id.toString().includes(searchLower);
            });
        }

        const total = await Message.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Messages retrieved successfully.",
            data: {
                messages: messages.reverse(), // Reverse to show oldest first
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Messages Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

