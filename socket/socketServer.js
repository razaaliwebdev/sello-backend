import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { Chat, Message } from '../models/chatModel.js';
import { generateChatbotResponse } from '../utils/chatbot.js';

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> socketId
const typingUsers = new Map(); // chatId -> Set of userIds typing

export const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || ["http://localhost:5173", "http://127.0.0.1:5173"],
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
                console.log('Socket connection attempt without token');
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
                console.error('JWT verification error:', jwtError.message);
                return next(new Error('Authentication error: Invalid token'));
            }
        } catch (error) {
            console.error('Socket auth error:', error.message);
            next(new Error('Authentication error: ' + error.message));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // Store user's socket connection
        activeUsers.set(socket.userId, socket.id);
        
        // Join user's personal room
        socket.join(`user:${socket.userId}`);

        // If admin, join admin room
        if (socket.user.role === 'admin') {
            socket.join('admin:room');
            console.log(`Admin connected: ${socket.userId}`);
        }

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
                console.log(`User ${socket.userId} joined ${chats.length} chat rooms`);
            } catch (error) {
                console.error('Error joining chats:', error);
            }
        });

        // Join a specific chat room
        socket.on('join-chat', async (chatId) => {
            try {
                if (!chatId) {
                    console.error('No chatId provided to join-chat');
                    return;
                }
                
                const chat = await Chat.findById(chatId);
                if (!chat) {
                    console.error('Chat not found:', chatId);
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
                    console.error('User not a participant in chat:', chatId);
                }
            } catch (error) {
                console.error('Error joining chat:', error);
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

                // Send notification to seller if buyer sent message in car chat
                if (chat.chatType === 'car' && socket.user.role === 'buyer') {
                    try {
                        const Car = (await import('../models/carModel.js')).default;
                        const Notification = (await import('../models/notificationModel.js')).default;
                        
                        const car = await Car.findById(chat.car).populate("postedBy", "name email role");
                        const seller = car?.postedBy;
                        
                        if (seller && seller._id.toString() !== socket.userId.toString()) {
                            // Create notification
                            await Notification.create({
                                title: "New Message from Buyer",
                                message: `${socket.user.name} sent you a message about "${car?.title || 'your listing'}"`,
                                type: "info",
                                recipient: seller._id,
                                actionUrl: `/seller/chats?chatId=${chatId}`,
                                actionText: "View Chat"
                            });

                            // Emit notification via socket
                            io.to(`user:${seller._id}`).emit('new-notification', {
                                title: "New Message from Buyer",
                                message: `${socket.user.name} sent you a message`,
                                chatId: chatId,
                                carId: car?._id
                            });
                        }
                    } catch (notifError) {
                        console.error("Error creating notification:", notifError);
                    }
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
        });
    });

    return io;
};

