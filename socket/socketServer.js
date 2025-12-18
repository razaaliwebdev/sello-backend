import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { Chat, Message } from '../models/chatModel.js';
import { generateChatbotResponse } from '../utils/chatbot.js';
import sendEmail from '../utils/sendEmail.js';
import Logger from '../utils/logger.js';

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> socketId
const typingUsers = new Map(); // chatId -> Set of userIds typing
const liveLocationTrackers = new Map(); // userId -> { carId, location, isActive }

export const initializeSocket = (server) => {
    // CORS configuration for Socket.io
    const allowedOrigins = process.env.CLIENT_URL 
        ? process.env.CLIENT_URL.split(',').map(url => url.trim())
        : ["http://localhost:5173", "http://127.0.0.1:5173"];
    
    if (process.env.PRODUCTION_URL) {
        allowedOrigins.push(process.env.PRODUCTION_URL);
    }

    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ["GET", "POST"],
            credentials: true,
            allowedHeaders: ["Authorization", "Content-Type"]
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    // Authentication middleware for Socket.io
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.split(' ')[1] ||
                socket.handshake.query?.token;

            if (!token) {
                Logger.warn('Socket connection attempt without token', { socketId: socket.id });
                return next(new Error('Authentication error: No token provided'));
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');

                if (!user) {
                    return next(new Error('Authentication error: User not found'));
                }

                socket.userId = user._id.toString();
                socket.user = user;
                next();
            } catch (jwtError) {
                Logger.error('JWT verification error in socket', jwtError, { socketId: socket.id });
                return next(new Error('Authentication error: Invalid token'));
            }
        } catch (error) {
            Logger.error('Socket auth error', error, { socketId: socket.id });
            next(new Error('Authentication error: ' + error.message));
        }
    });

    io.on('connection', (socket) => {
        Logger.info(`User connected via socket`, { userId: socket.userId, socketId: socket.id });

        // Store user's socket connection
        activeUsers.set(socket.userId, socket.id);

        // Join user's personal room
        socket.join(`user:${socket.userId}`);

        // Join role-based room for notifications
        if (socket.user.role) {
            socket.join(`role:${socket.user.role}`);
            console.log(`User ${socket.userId} joined role room: role:${socket.user.role}`);
        }

        // If admin, join admin room
        if (socket.user.role === 'admin') {
            socket.join('admin:room');
            console.log(`Admin connected: ${socket.userId}`);
        }

        // Join notifications room
        socket.on('join-notifications', () => {
            socket.join(`user:${socket.userId}`);
            console.log(`User ${socket.userId} joined notifications room`);
        });

        // Join all user's chat rooms (both support and car chats)
        socket.on('join-chats', async () => {
            try {
                const chats = await Chat.find({
                    participants: socket.userId,
                    chatType: { $in: ['support', 'car'] }
                });

                chats.forEach(chat => {
                    socket.join(`chat:${chat._id}`);
                });
                Logger.info(`User joined chat rooms`, { userId: socket.userId, chatCount: chats.length });
            } catch (error) {
                Logger.error('Error joining chats', error, { userId: socket.userId });
            }
        });

        // Join a specific chat room
        socket.on('join-chat', async (chatId) => {
            try {
                if (!chatId) {
                    Logger.warn('No chatId provided to join-chat', { userId: socket.userId });
                    return;
                }

                const chat = await Chat.findById(chatId);
                if (!chat) {
                    Logger.warn('Chat not found', { chatId, userId: socket.userId });
                    return;
                }

                // Check if user is participant (convert to string for comparison)
                const userIdStr = socket.userId.toString();
                const isParticipant = chat.participants.some(p =>
                    p.toString() === userIdStr || p._id?.toString() === userIdStr
                );

                if (isParticipant) {
                    socket.join(`chat:${chatId}`);
                    socket.emit('joined-chat', chatId);
                    console.log(`User ${socket.userId} joined chat ${chatId}`);
                } else {
                    Logger.warn('User not a participant in chat', { chatId, userId: socket.userId });
                }
            } catch (error) {
                Logger.error('Error joining chat', error, { chatId, userId: socket.userId });
            }
        });

        // Handle typing indicator
        socket.on('typing', async ({ chatId, isTyping }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat || !chat.participants.includes(socket.userId)) {
                    return;
                }

                if (isTyping) {
                    if (!typingUsers.has(chatId)) {
                        typingUsers.set(chatId, new Set());
                    }
                    typingUsers.get(chatId).add(socket.userId);
                } else {
                    if (typingUsers.has(chatId)) {
                        typingUsers.get(chatId).delete(socket.userId);
                        if (typingUsers.get(chatId).size === 0) {
                            typingUsers.delete(chatId);
                        }
                    }
                }

                // Get typing users (excluding current user)
                const typingUserIds = Array.from(typingUsers.get(chatId) || [])
                    .filter(id => id !== socket.userId);

                // Emit to other participants
                socket.to(`chat:${chatId}`).emit('typing', {
                    chatId,
                    userIds: typingUserIds,
                    userNames: typingUserIds.map(id => {
                        // This would need to be populated from a cache or DB
                        return 'Someone';
                    })
                });
            } catch (error) {
                console.error('Error handling typing:', error);
            }
        });

        // Handle sending message
        socket.on('send-message', async ({ chatId, message, messageType = 'text', attachments = [] }) => {
            try {
                if (!chatId || !message) {
                    socket.emit('error', { message: 'Chat ID and message are required' });
                    return;
                }

                const chat = await Chat.findById(chatId);
                if (!chat) {
                    socket.emit('error', { message: 'Chat not found' });
                    return;
                }

                // Check if user is participant (convert to string for comparison)
                const userIdStr = socket.userId.toString();
                const isParticipant = chat.participants.some(p =>
                    p.toString() === userIdStr || p._id?.toString() === userIdStr
                );

                if (!isParticipant) {
                    socket.emit('error', { message: 'Access denied. You are not a participant in this chat.' });
                    return;
                }

                // Create message
                const newMessage = await Message.create({
                    chat: chatId,
                    sender: socket.userId,
                    message: message.trim(),
                    messageType,
                    attachments,
                    isBot: false
                });

                // Populate sender
                await newMessage.populate('sender', 'name email avatar role');

                // Update chat
                chat.lastMessage = message.trim();
                chat.lastMessageAt = new Date();
                chat.isActive = true;

                // Update unread count for other participants
                chat.participants.forEach(participantId => {
                    if (participantId.toString() !== socket.userId) {
                        const currentUnread = chat.unreadCount.get(participantId.toString()) || 0;
                        chat.unreadCount.set(participantId.toString(), currentUnread + 1);
                    }
                });

                await chat.save();

                // Emit to all participants in the chat room
                io.to(`chat:${chatId}`).emit('new-message', {
                    message: newMessage,
                    chat: chat,
                    chatId: chatId
                });

                // Create and emit user notifications for chat participants (buyer / seller / dealer)
                try {
                    const Notification = (await import('../models/notificationModel.js')).default;

                    const senderId = socket.userId.toString();
                    const participantIds = chat.participants.map((p) => p.toString());
                    const recipientIds = participantIds.filter((id) => id !== senderId);

                    if (recipientIds.length > 0) {
                        let car = null;
                        if (chat.chatType === 'car' && chat.car) {
                            const Car = (await import('../models/carModel.js')).default;
                            car = await Car.findById(chat.car).populate('postedBy', 'name email role');
                        }

                        // Load recipient users (for role / email)
                        const recipients = await User.find({ _id: { $in: recipientIds } }).select('name email role');
                        const recipientsMap = new Map(
                            recipients.map((u) => [u._id.toString(), u])
                        );

                        const siteName = process.env.SITE_NAME || 'Sello';
                        const clientUrl =
                            process.env.CLIENT_URL?.split(',')[0]?.trim() ||
                            'https://sello.ae';
                        const emailEnabled =
                            process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';

                        for (const recipientId of recipientIds) {
                            const recipientUser = recipientsMap.get(recipientId);
                            if (!recipientUser) continue;

                            // Skip admin system notifications here – focus on buyer/seller/dealer
                            if (recipientUser.role === 'admin') continue;

                            let title = 'New Message';
                            let messageText = '';
                            let actionUrl = '';

                            if (chat.chatType === 'car') {
                                const listingTitle = car?.title || 'your listing';

                                // If this recipient is the listing owner (seller/dealer)
                                const isListingOwner =
                                    car?.postedBy &&
                                    car.postedBy._id.toString() === recipientId;

                                messageText = `${socket.user.name} sent you a message about "${listingTitle}"`;

                                // Seller/dealer sees seller chats page, buyers see generic chats
                                if (isListingOwner) {
                                    actionUrl = `/seller/chats?chatId=${chatId}`;
                                } else {
                                    actionUrl = `/chats?chatId=${chatId}`;
                                }
                            } else {
                                // Support chat
                                messageText = `${socket.user.name} sent you a support message`;
                                actionUrl = `/support?chatId=${chatId}`;
                            }

                            // Create Notification document
                            await Notification.create({
                                title,
                                message: messageText,
                                type: 'info',
                                recipient: recipientId,
                                actionUrl,
                                actionText: 'View Chat'
                            });

                            // Emit in-app notification via socket
                            io.to(`user:${recipientId}`).emit('new-notification', {
                                title,
                                message: messageText,
                                chatId,
                                carId: car?._id || null,
                                actionUrl
                            });

                            // Optional: email notification for chat messages
                            if (emailEnabled && recipientUser.email) {
                                const emailSubject = `${siteName} – ${title}`;
                                const emailActionHref = `${clientUrl}${actionUrl}`;

                                const emailHtml = `
                                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
                                        <h2 style="color:#111827;margin-bottom:8px;">${siteName} – ${title}</h2>
                                        <p style="margin:0 0 12px 0;">Hi ${recipientUser.name || ''},</p>
                                        <p style="margin:0 0 16px 0;">${messageText}</p>
                                        <p style="margin:0 0 16px 0;">
                                            <a href="${emailActionHref}" style="display:inline-block;padding:10px 18px;background:#F97316;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;">
                                                View chat
                                            </a>
                                        </p>
                                        <p style="font-size:12px;color:#6B7280;margin-top:24px;">
                                            You are receiving this because you have an account on ${siteName}.
                                        </p>
                                    </div>
                                `;

                                try {
                                    await sendEmail(recipientUser.email, emailSubject, emailHtml);
                                } catch (emailError) {
                                    console.error(
                                        `Chat notification email error for user ${recipientUser._id}:`,
                                        emailError.message
                                    );
                                }
                            }
                        }
                    }
                } catch (notifError) {
                    console.error('Error creating chat notifications:', notifError);
                }

                // Try chatbot response only for support chats (not car chats)
                // Don't trigger chatbot if admin is responding
                if (socket.user.role !== 'admin' && chat.chatType === 'support') {
                    setTimeout(async () => {
                        try {
                            const chatbotResponse = await generateChatbotResponse(message, chatId);
                            if (chatbotResponse) {
                                // Create bot message
                                const botMessage = await Message.create({
                                    chat: chatId,
                                    sender: null, // Bot has no sender
                                    message: chatbotResponse,
                                    messageType: 'text',
                                    isBot: true
                                });

                                // Update chat
                                chat.lastMessage = chatbotResponse;
                                chat.lastMessageAt = new Date();
                                await chat.save();

                                // Emit bot message
                                io.to(`chat:${chatId}`).emit('new-message', {
                                    message: botMessage,
                                    chat: chat,
                                    chatId: chatId
                                });
                            }
                        } catch (error) {
                            console.error('Chatbot error:', error);
                        }
                    }, 1000); // 1 second delay for bot response
                } else if (socket.user.role === 'admin') {
                    // Admin message - update unread count for user
                    chat.participants.forEach(participantId => {
                        if (participantId.toString() !== socket.userId) {
                            const currentUnread = chat.unreadCount.get(participantId.toString()) || 0;
                            chat.unreadCount.set(participantId.toString(), currentUnread + 1);
                        }
                    });
                    await chat.save();
                }
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle message seen
        socket.on('message-seen', async ({ messageId, chatId }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) return;

                if (!message.seenBy.includes(socket.userId)) {
                    message.seenBy.push(socket.userId);
                    await message.save();

                    // Emit seen status to chat
                    io.to(`chat:${chatId}`).emit('message-seen', {
                        messageId,
                        seenBy: message.seenBy
                    });
                }
            } catch (error) {
                console.error('Error marking message as seen:', error);
            }
        });

        // Handle mark chat as read (Bulk)
        socket.on('mark-chat-read', async ({ chatId }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat) return;

                // Reset unread count for this user
                if (chat.unreadCount && chat.unreadCount.has(socket.userId)) {
                    chat.unreadCount.set(socket.userId, 0);
                    await chat.save();
                }

                // Mark all messages as seen by this user
                await Message.updateMany(
                    { chat: chatId, seenBy: { $ne: socket.userId } },
                    { $addToSet: { seenBy: socket.userId } }
                );

                // Emit update
                io.to(`chat:${chatId}`).emit('chat-read', {
                    chatId,
                    userId: socket.userId
                });
            } catch (error) {
                console.error('Error marking chat as read:', error);
            }
        });

        // Handle delete message
        socket.on('delete-message', async ({ messageId, chatId }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }

                // Check if user owns the message or is admin
                if (message.sender.toString() !== socket.userId && socket.user.role !== 'admin') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                message.isDeleted = true;
                message.deletedAt = new Date();
                await message.save();

                // Emit to chat
                io.to(`chat:${chatId}`).emit('message-deleted', {
                    messageId,
                    chatId
                });
            } catch (error) {
                console.error('Error deleting message:', error);
                socket.emit('error', { message: 'Failed to delete message' });
            }
        });

        // Live Location Tracking - Seller enables live location for a car
        socket.on('enable-live-location', async ({ carId, location }) => {
            try {
                if (!carId || !location || !location.coordinates) {
                    socket.emit('error', { message: 'Car ID and location are required' });
                    return;
                }

                // Verify user owns the car
                const Car = (await import('../models/carModel.js')).default;
                const car = await Car.findById(carId);
                
                if (!car || car.postedBy.toString() !== socket.userId) {
                    socket.emit('error', { message: 'Unauthorized: You do not own this car' });
                    return;
                }

                // Store live location tracking
                liveLocationTrackers.set(socket.userId, {
                    carId,
                    location: {
                        type: 'Point',
                        coordinates: location.coordinates // [longitude, latitude]
                    },
                    isActive: true,
                    updatedAt: new Date()
                });

                // Join car-specific room for location updates
                socket.join(`car-location:${carId}`);
                
                // Notify buyers viewing this car
                io.to(`car-location:${carId}`).emit('live-location-enabled', {
                    carId,
                    location: liveLocationTrackers.get(socket.userId).location
                });

                socket.emit('live-location-enabled', { carId });
                console.log(`Live location enabled for car ${carId} by user ${socket.userId}`);
            } catch (error) {
                console.error('Error enabling live location:', error);
                socket.emit('error', { message: 'Failed to enable live location' });
            }
        });

        // Update live location (seller sends periodic updates)
        socket.on('update-live-location', ({ carId, location }) => {
            try {
                const tracker = liveLocationTrackers.get(socket.userId);
                if (!tracker || tracker.carId !== carId || !tracker.isActive) {
                    socket.emit('error', { message: 'Live location not enabled for this car' });
                    return;
                }

                // Update location
                tracker.location = {
                    type: 'Point',
                    coordinates: location.coordinates // [longitude, latitude]
                };
                tracker.updatedAt = new Date();

                // Broadcast to buyers viewing this car
                io.to(`car-location:${carId}`).emit('live-location-update', {
                    carId,
                    location: tracker.location,
                    updatedAt: tracker.updatedAt
                });
            } catch (error) {
                console.error('Error updating live location:', error);
                socket.emit('error', { message: 'Failed to update live location' });
            }
        });

        // Disable live location
        socket.on('disable-live-location', ({ carId }) => {
            try {
                const tracker = liveLocationTrackers.get(socket.userId);
                if (tracker && tracker.carId === carId) {
                    tracker.isActive = false;
                    liveLocationTrackers.delete(socket.userId);
                    
                    // Notify buyers
                    io.to(`car-location:${carId}`).emit('live-location-disabled', { carId });
                    socket.emit('live-location-disabled', { carId });
                    console.log(`Live location disabled for car ${carId} by user ${socket.userId}`);
                }
            } catch (error) {
                console.error('Error disabling live location:', error);
            }
        });

        // Buyer subscribes to live location updates for a car
        socket.on('subscribe-car-location', ({ carId }) => {
            try {
                socket.join(`car-location:${carId}`);
                
                // Send current location if available
                const tracker = Array.from(liveLocationTrackers.values())
                    .find(t => t.carId === carId && t.isActive);
                
                if (tracker) {
                    socket.emit('live-location-update', {
                        carId,
                        location: tracker.location,
                        updatedAt: tracker.updatedAt
                    });
                }
            } catch (error) {
                console.error('Error subscribing to car location:', error);
            }
        });

        // Buyer unsubscribes from live location updates
        socket.on('unsubscribe-car-location', ({ carId }) => {
            try {
                socket.leave(`car-location:${carId}`);
            } catch (error) {
                console.error('Error unsubscribing from car location:', error);
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
            activeUsers.delete(socket.userId);

            // Remove from typing indicators
            typingUsers.forEach((userSet, chatId) => {
                userSet.delete(socket.userId);
                if (userSet.size === 0) {
                    typingUsers.delete(chatId);
                }
            });

            // Clean up live location tracking
            const tracker = liveLocationTrackers.get(socket.userId);
            if (tracker) {
                io.to(`car-location:${tracker.carId}`).emit('live-location-disabled', {
                    carId: tracker.carId
                });
                liveLocationTrackers.delete(socket.userId);
            }
        });
    });

    return io;
};

