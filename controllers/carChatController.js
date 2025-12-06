import { Chat, Message } from '../models/chatModel.js';
import Car from '../models/carModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Create or Get Car Chat (Buyer-Seller)
 */
export const createCarChat = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login to start a chat."
            });
        }

        const { carId } = req.params;

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

        // Check if car is sold
        if (car.isSold) {
            return res.status(400).json({
                success: false,
                message: "This car has been sold and is no longer available for chat."
            });
        }

        const sellerId = car.postedBy;
        const buyerId = req.user._id;

        // Check if buyer is trying to chat with themselves
        if (sellerId.toString() === buyerId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot chat with yourself."
            });
        }

        // Check if chat already exists
        let chat = await Chat.findOne({
            chatType: 'car',
            car: carId,
            participants: { $all: [buyerId, sellerId] }
        }).populate("participants", "name email avatar role");

        if (chat) {
            // Convert Map to object for JSON serialization
            const chatData = chat.toObject();
            if (chatData.unreadCount instanceof Map) {
                chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
            }

            return res.status(200).json({
                success: true,
                message: "Chat retrieved successfully.",
                data: chatData
            });
        }

        // Create new chat
        chat = await Chat.create({
            participants: [buyerId, sellerId],
            chatType: 'car',
            car: carId,
            subject: `${car.make} ${car.model} - ${car.year}`,
            status: 'open',
            lastMessage: "",
            lastMessageAt: new Date(),
            unreadCount: new Map([[buyerId.toString(), 0], [sellerId.toString(), 0]])
        });

        const populatedChat = await Chat.findById(chat._id)
            .populate("participants", "name email avatar role")
            .populate("car", "title make model price images isSold");

        // Convert Map to object for JSON serialization
        const chatData = populatedChat.toObject();
        if (chatData.unreadCount instanceof Map) {
            chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
        }

        return res.status(201).json({
            success: true,
            message: "Chat created successfully.",
            data: chatData
        });
    } catch (error) {
        console.error("Create Car Chat Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Car Chat by Car ID
 */
export const getCarChatByCarId = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { carId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        const chat = await Chat.findOne({
            chatType: 'car',
            car: carId,
            participants: req.user._id
        })
            .populate("participants", "name email avatar role")
            .populate("car", "title make model price images isSold");

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found. Create a chat first."
            });
        }

        // Convert Map to object for JSON serialization
        const chatData = chat.toObject();
        if (chatData.unreadCount instanceof Map) {
            chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
        }

        return res.status(200).json({
            success: true,
            message: "Chat retrieved successfully.",
            data: chatData
        });
    } catch (error) {
        console.error("Get Car Chat Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get User's Car Chats
 */
export const getCarChats = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const chats = await Chat.find({
            chatType: 'car',
            participants: req.user._id
        })
            .populate("participants", "name email avatar role")
            .populate("car", "title make model price images isSold")
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
            message: "Car chats retrieved successfully.",
            data: chatsData
        });
    } catch (error) {
        console.error("Get Car Chats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Seller's Buyer Chats (for sellers - chats for their listings)
 */
export const getSellerBuyerChats = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        // Check if user is seller or dealer
        if (!['seller', 'dealer'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only sellers and dealers can access this endpoint."
            });
        }

        // Find all cars posted by this seller
        const sellerCars = await Car.find({ postedBy: req.user._id }).select('_id');
        const carIds = sellerCars.map(car => car._id);

        if (carIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No chats found for your listings.",
                data: []
            });
        }

        // Find all chats for these cars
        const chats = await Chat.find({
            chatType: 'car',
            car: { $in: carIds }
        })
            .populate("participants", "name email avatar role")
            .populate("car", "title make model price images isSold postedBy")
            .sort({ lastMessageAt: -1 });

        // Convert Maps to objects for JSON serialization
        const chatsData = chats.map(chat => {
            const chatObj = chat.toObject();
            if (chatObj.unreadCount instanceof Map) {
                chatObj.unreadCount = Object.fromEntries(chatObj.unreadCount);
            }
            // Get buyer (the other participant who is not the seller)
            const buyer = chatObj.participants?.find(
                p => p._id.toString() !== req.user._id.toString()
            );
            chatObj.buyer = buyer;
            return chatObj;
        });

        return res.status(200).json({
            success: true,
            message: "Seller buyer chats retrieved successfully.",
            data: chatsData
        });
    } catch (error) {
        console.error("Get Seller Buyer Chats Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Car Chat Messages
 */
export const getCarChatMessages = async (req, res) => {
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
        console.error("Get Car Chat Messages Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send Message in Car Chat
 */
export const sendCarChatMessage = async (req, res) => {
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
        if (!chat || chat.chatType !== 'car') {
            return res.status(404).json({
                success: false,
                message: "Car chat not found."
            });
        }

        // Check if user is participant
        if (!chat.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this chat."
            });
        }

        // Check if user is blocked by the other participant
        const otherParticipantId = chat.participants.find(
            p => p.toString() !== req.user._id.toString()
        );
        if (otherParticipantId) {
            const otherUser = await User.findById(otherParticipantId).select("blockedUsers");
            if (otherUser && otherUser.blockedUsers && otherUser.blockedUsers.includes(req.user._id)) {
                return res.status(403).json({
                    success: false,
                    message: "You have been blocked by this user."
                });
            }
            
            // Check if current user has blocked the other participant
            const currentUser = await User.findById(req.user._id).select("blockedUsers");
            if (currentUser && currentUser.blockedUsers && currentUser.blockedUsers.includes(otherParticipantId)) {
                return res.status(403).json({
                    success: false,
                    message: "You have blocked this user. Unblock them to send messages."
                });
            }
        }

        // Get car and check if sold
        const car = await Car.findById(chat.car).populate("postedBy", "name email role");
        if (car && car.isSold) {
            return res.status(400).json({
                success: false,
                message: "This car has been sold. Chat is no longer active."
            });
        }

        // Handle file uploads if any
        let uploadedAttachments = [];
        if (req.files && req.files.length > 0) {
            const { uploadCloudinary } = await import('../utils/cloudinary.js');
            uploadedAttachments = await Promise.all(
                req.files.map(async (file) => {
                    try {
                        const url = await uploadCloudinary(file.buffer || file.path);
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

        // Get seller info (car already populated above)
        const seller = car?.postedBy;
        const buyer = req.user;

        // Send notification to seller if buyer sent the message
        if (seller && buyer.role === 'buyer' && seller._id.toString() !== buyer._id.toString()) {
            try {
                const Notification = (await import('../models/notificationModel.js')).default;
                await Notification.create({
                    title: "New Message from Buyer",
                    message: `${buyer.name} sent you a message about "${car?.title || 'your listing'}"`,
                    type: "info",
                    recipient: seller._id,
                    actionUrl: `/seller/chats?chatId=${chatId}`,
                    actionText: "View Chat"
                });

                // Emit notification via socket
                const io = req.app.get('io');
                if (io) {
                    io.to(`user:${seller._id}`).emit('new-notification', {
                        title: "New Message from Buyer",
                        message: `${buyer.name} sent you a message`,
                        chatId: chatId,
                        carId: car?._id
                    });
                }
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Don't fail the message send if notification fails
            }
        }

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${chatId}`).emit('new-message', {
                message: populatedMessage,
                chat: chat,
                chatId: chatId
            });
        }

        // Track analytics
        try {
            const { trackEvent, AnalyticsEvents } = await import('../utils/analytics.js');
            await trackEvent(AnalyticsEvents.MESSAGE_SEND, req.user._id, {
                chatId: chatId.toString(),
                carId: car?._id?.toString()
            });
        } catch (analyticsError) {
            // Don't fail the request if analytics fails
            console.error('Failed to track analytics:', analyticsError);
        }

        return res.status(201).json({
            success: true,
            message: "Message sent successfully.",
            data: populatedMessage
        });
    } catch (error) {
        console.error("Send Car Chat Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Edit Car Chat Message (Own messages only)
 */
export const editCarChatMessage = async (req, res) => {
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

        // Check if user is the sender
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
        console.error("Edit Car Chat Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Car Chat Message (Own messages only)
 */
export const deleteCarChatMessage = async (req, res) => {
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

        // Check if user is the sender
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
        console.error("Delete Car Chat Message Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Block User in Chat
 */
export const blockUserInChat = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot block yourself."
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Check if already blocked
        if (user.blockedUsers && user.blockedUsers.includes(userId)) {
            return res.status(200).json({
                success: true,
                message: "User is already blocked.",
                data: { blocked: true }
            });
        }

        // Add to blocked list
        if (!user.blockedUsers) {
            user.blockedUsers = [];
        }
        user.blockedUsers.push(userId);
        await user.save();

        return res.status(200).json({
            success: true,
            message: "User blocked successfully.",
            data: { blocked: true }
        });
    } catch (error) {
        console.error("Block User Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Unblock User
 */
export const unblockUser = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Remove from blocked list
        if (user.blockedUsers) {
            user.blockedUsers = user.blockedUsers.filter(
                id => id.toString() !== userId.toString()
            );
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: "User unblocked successfully.",
            data: { blocked: false }
        });
    } catch (error) {
        console.error("Unblock User Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Blocked Users
 */
export const getBlockedUsers = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const user = await User.findById(req.user._id)
            .select("blockedUsers")
            .populate("blockedUsers", "name email avatar role");

        return res.status(200).json({
            success: true,
            message: "Blocked users retrieved successfully.",
            data: user.blockedUsers || []
        });
    } catch (error) {
        console.error("Get Blocked Users Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

