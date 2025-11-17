import { Chat, Message } from '../models/chatModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Create Support Chat (User)
 */
export const createSupportChat = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login to create a support chat."
            });
        }

        const { subject, message, priority } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Subject and initial message are required."
            });
        }

        // Find admin user - get the first admin
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.error("No admin user found in database. Please create an admin user.");
            return res.status(500).json({
                success: false,
                message: "Support system is not available. Please contact support directly.",
                error: "No admin user found"
            });
        }

        // Check if user already has an open support chat
        const existingChat = await Chat.findOne({
            chatType: 'support',
            participants: { $all: [req.user._id, admin._id] },
            status: 'open'
        });

        if (existingChat) {
            // Add message to existing chat
            const newMessage = await Message.create({
                chat: existingChat._id,
                sender: req.user._id,
                message: message,
                messageType: 'text'
            });

            existingChat.lastMessage = message;
            existingChat.lastMessageAt = new Date();
            existingChat.subject = subject; // Update subject if provided
            if (priority) existingChat.priority = priority;
            
            // Update unread count for admin
            if (!existingChat.unreadCount) {
                existingChat.unreadCount = new Map();
            }
            const adminIdStr = admin._id.toString();
            const currentUnread = existingChat.unreadCount.get(adminIdStr) || 0;
            existingChat.unreadCount.set(adminIdStr, currentUnread + 1);
            
            await existingChat.save();

            // Try chatbot response
            try {
                const { generateChatbotResponse } = await import('../utils/chatbot.js');
                const chatbotResponse = await generateChatbotResponse(message, existingChat._id);
                if (chatbotResponse) {
                    const botMessage = await Message.create({
                        chat: existingChat._id,
                        sender: null,
                        message: chatbotResponse,
                        messageType: 'text',
                        isBot: true
                    });

                    existingChat.lastMessage = chatbotResponse;
                    existingChat.lastMessageAt = new Date();
                    await existingChat.save();

                    // Emit bot message via socket if available
                    const io = req.app.get('io');
                    if (io) {
                        io.to(`chat:${existingChat._id}`).emit('new-message', {
                            message: botMessage,
                            chat: existingChat,
                            chatId: existingChat._id
                        });
                    }
                }
            } catch (botError) {
                console.error('Chatbot error:', botError);
            }

            // Convert Map to object for JSON serialization
            const chatData = existingChat.toObject();
            if (chatData.unreadCount instanceof Map) {
                chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
            }

            return res.status(200).json({
                success: true,
                message: "Message added to existing support chat.",
                data: {
                    chat: chatData,
                    message: newMessage
                }
            });
        }

        // Create new support chat
        const chat = await Chat.create({
            participants: [req.user._id, admin._id],
            chatType: 'support',
            subject: subject,
            priority: priority || 'medium',
            status: 'open',
            lastMessage: message,
            lastMessageAt: new Date(),
            unreadCount: new Map([[admin._id.toString(), 1]])
        });

        // Create initial message
        const initialMessage = await Message.create({
            chat: chat._id,
            sender: req.user._id,
            message: message,
            messageType: 'text'
        });

        // Send welcome message from chatbot
        try {
            const { generateChatbotResponse } = await import('../utils/chatbot.js');
            const welcomeMessage = "Hello! Welcome to SELLO support. I'm your AI assistant. How can I help you today?";
            
            const botMessage = await Message.create({
                chat: chat._id,
                sender: null,
                message: welcomeMessage,
                messageType: 'text',
                isBot: true
            });

            // Update chat with bot message
            chat.lastMessage = welcomeMessage;
            chat.lastMessageAt = new Date();
            await chat.save();

            // Emit bot message via socket if available
            const io = req.app.get('io');
            if (io) {
                io.to(`chat:${chat._id}`).emit('new-message', {
                    message: botMessage,
                    chat: chat,
                    chatId: chat._id
                });
            }
        } catch (botError) {
            console.error('Error sending chatbot welcome message:', botError);
            // Don't fail the chat creation if bot fails
        }

        const populatedChat = await Chat.findById(chat._id)
            .populate("participants", "name email avatar role");

        // Convert Map to object for JSON serialization
        const chatData = populatedChat.toObject();
        if (chatData.unreadCount instanceof Map) {
            chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
        }

        return res.status(201).json({
            success: true,
            message: "Support chat created successfully.",
            data: {
                chat: chatData,
                message: initialMessage
            }
        });
    } catch (error) {
        console.error("Create Support Chat Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get User's Support Chats
 */
export const getUserSupportChats = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const chats = await Chat.find({
            chatType: 'support',
            participants: req.user._id
        })
            .populate("participants", "name email avatar role")
            .sort({ lastMessageAt: -1 });

        // Convert Maps to objects for JSON serialization
        const chatsData = chats.map(chat => {
            const chatObj = chat.toObject();
            if (chatObj.unreadCount instanceof Map) {
                chatObj.unreadCount = Object.fromEntries(chatObj.unreadCount);
            }
            return chatObj;
        });

        return res.status(200).json({
            success: true,
            message: "Support chats retrieved successfully.",
            data: chatsData
        });
    } catch (error) {
        console.error("Get User Support Chats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Support Chat Messages (User)
 */
export const getSupportChatMessages = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { chatId } = req.params;

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

        // Check if user is participant
        if (!chat.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this chat."
            });
        }

        const messages = await Message.find({ chat: chatId, isDeleted: false })
            .populate("sender", "name email avatar role")
            .sort({ createdAt: 1 });

        // Mark messages as read for current user
        await Message.updateMany(
            {
                chat: chatId,
                sender: { $ne: req.user._id },
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        // Update unread count
        chat.unreadCount.set(req.user._id.toString(), 0);
        await chat.save();

        return res.status(200).json({
            success: true,
            message: "Messages retrieved successfully.",
            data: messages
        });
    } catch (error) {
        console.error("Get Support Chat Messages Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send Message in Support Chat (User)
 */
export const sendSupportMessage = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { chatId } = req.params;
        const { message, messageType = 'text', attachments = [] } = req.body;

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

        // Check if user is participant
        if (!chat.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this chat."
            });
        }

        // Handle file uploads if any
        let uploadedAttachments = [];
        if (req.files && req.files.length > 0) {
            const { uploadCloudinary } = await import('../utils/cloudinary.js');
            uploadedAttachments = await Promise.all(
                req.files.map(async (file) => {
                    try {
                        const url = await uploadCloudinary(file.buffer);
                        return url;
                    } catch (err) {
                        console.error("Error uploading attachment:", err);
                        return null;
                    }
                })
            );
            uploadedAttachments = uploadedAttachments.filter(url => url);
        }

        // Create message
        const newMessage = await Message.create({
            chat: chatId,
            sender: req.user._id,
            message: message.trim(),
            messageType: messageType,
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : (attachments || [])
        });

        // Update chat
        chat.lastMessage = message.trim();
        chat.lastMessageAt = new Date();
        chat.isActive = true;
        if (chat.status === 'closed') {
            chat.status = 'open'; // Reopen if closed
        }

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

        // Try chatbot response for user messages (not admin)
        if (req.user.role !== 'admin') {
            try {
                const { generateChatbotResponse } = await import('../utils/chatbot.js');
                const chatbotResponse = await generateChatbotResponse(message.trim(), chatId);
                if (chatbotResponse) {
                    const botMessage = await Message.create({
                        chat: chatId,
                        sender: null,
                        message: chatbotResponse,
                        messageType: 'text',
                        isBot: true
                    });

                    chat.lastMessage = chatbotResponse;
                    chat.lastMessageAt = new Date();
                    await chat.save();

                    // Emit bot message via socket if available
                    const io = req.app.get('io');
                    if (io) {
                        io.to(`chat:${chatId}`).emit('new-message', {
                            message: botMessage,
                            chat: chat,
                            chatId: chatId
                        });
                    }
                }
            } catch (botError) {
                console.error('Chatbot error:', botError);
            }
        }

        // Emit user message via socket if available
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
        console.error("Send Support Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Support Chats (Admin)
 */
export const getAllSupportChats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all support chats."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { status, priority, search } = req.query;

        const query = { chatType: 'support' };
        if (status) query.status = status;
        if (priority) query.priority = priority;

        let chats = await Chat.find(query)
            .populate("participants", "name email avatar role")
            .skip(skip)
            .limit(limit)
            .sort({ lastMessageAt: -1 });

        // Filter by search if provided
        if (search) {
            chats = chats.filter(chat => {
                const participantNames = chat.participants
                    .filter(p => p.role !== 'admin')
                    .map(p => p.name)
                    .join(' ');
                const subject = chat.subject || '';
                return participantNames.toLowerCase().includes(search.toLowerCase()) ||
                       subject.toLowerCase().includes(search.toLowerCase());
            });
        }

        const total = await Chat.countDocuments(query);

        // Convert Maps to objects for JSON serialization
        const chatsData = chats.map(chat => {
            const chatObj = chat.toObject();
            if (chatObj.unreadCount instanceof Map) {
                chatObj.unreadCount = Object.fromEntries(chatObj.unreadCount);
            }
            return chatObj;
        });

        return res.status(200).json({
            success: true,
            message: "Support chats retrieved successfully.",
            data: {
                chats: chatsData,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Support Chats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send Admin Response (Admin)
 */
export const sendAdminResponse = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can send responses."
            });
        }

        const { chatId } = req.params;
        const { message, messageType = 'text', attachments = [] } = req.body;

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
        if (!chat || chat.chatType !== 'support') {
            return res.status(404).json({
                success: false,
                message: "Support chat not found."
            });
        }

        // Handle file uploads if any
        let uploadedAttachments = [];
        if (req.files && req.files.length > 0) {
            const { uploadCloudinary } = await import('../utils/cloudinary.js');
            uploadedAttachments = await Promise.all(
                req.files.map(async (file) => {
                    try {
                        const url = await uploadCloudinary(file.buffer);
                        return url;
                    } catch (err) {
                        console.error("Error uploading attachment:", err);
                        return null;
                    }
                })
            );
            uploadedAttachments = uploadedAttachments.filter(url => url);
        }

        // Create message
        const newMessage = await Message.create({
            chat: chatId,
            sender: req.user._id,
            message: message.trim(),
            messageType: messageType,
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : (attachments || [])
        });

        // Update chat
        chat.lastMessage = message.trim();
        chat.lastMessageAt = new Date();
        chat.isActive = true;

        // Update unread count for user (not admin)
        chat.participants.forEach(participantId => {
            if (participantId.toString() !== req.user._id.toString()) {
                const currentUnread = chat.unreadCount.get(participantId.toString()) || 0;
                chat.unreadCount.set(participantId.toString(), currentUnread + 1);
            }
        });

        await chat.save();

        const populatedMessage = await Message.findById(newMessage._id)
            .populate("sender", "name email avatar role");

        // Emit admin message via socket if available
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
            message: "Response sent successfully.",
            data: populatedMessage
        });
    } catch (error) {
        console.error("Send Admin Response Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Support Chat Status (Admin)
 */
export const updateSupportChatStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update chat status."
            });
        }

        const { chatId } = req.params;
        const { status, priority } = req.body;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID."
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat || chat.chatType !== 'support') {
            return res.status(404).json({
                success: false,
                message: "Support chat not found."
            });
        }

        if (status && ['open', 'resolved', 'closed'].includes(status)) {
            chat.status = status;
        }
        if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
            chat.priority = priority;
        }

        await chat.save();

        return res.status(200).json({
            success: true,
            message: "Chat status updated successfully.",
            data: chat
        });
    } catch (error) {
        console.error("Update Support Chat Status Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Edit Support Message (User/Admin - own messages only)
 */
export const editSupportMessage = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
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

        // Check if message is deleted
        if (messageDoc.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Cannot edit deleted message."
            });
        }

        // Check if user is the sender (users can only edit their own messages)
        if (messageDoc.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only edit your own messages."
            });
        }

        // Check if user is participant in the chat
        const chat = await Chat.findById(messageDoc.chat);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });
        }

        if (!chat.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this chat."
            });
        }

        // Update message
        messageDoc.message = message.trim();
        messageDoc.editedAt = new Date();
        messageDoc.isEdited = true;
        await messageDoc.save();

        // Update chat last message if this was the last message
        if (chat.lastMessage === messageDoc.message || chat._id.toString() === messageDoc.chat.toString()) {
            chat.lastMessage = message.trim();
            await chat.save();
        }

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
        console.error("Edit Support Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Support Message (User/Admin - own messages only)
 */
export const deleteSupportMessage = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { messageId } = req.params;

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

        // Check if message is already deleted
        if (messageDoc.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Message is already deleted."
            });
        }

        // Check if user is the sender (users can only delete their own messages)
        if (messageDoc.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own messages."
            });
        }

        // Check if user is participant in the chat
        const chat = await Chat.findById(messageDoc.chat);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });
        }

        if (!chat.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this chat."
            });
        }

        // Soft delete
        messageDoc.isDeleted = true;
        messageDoc.deletedAt = new Date();
        await messageDoc.save();

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${messageDoc.chat}`).emit('message-deleted', {
                messageId: messageDoc._id,
                chatId: messageDoc.chat
            });
        }

        return res.status(200).json({
            success: true,
            message: "Message deleted successfully."
        });
    } catch (error) {
        console.error("Delete Support Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

