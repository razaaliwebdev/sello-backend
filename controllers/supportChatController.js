import { Chat, Message } from "../models/chatModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";

/**
 * Create Support Chat (User)
 */
export const createSupportChat = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login to create a support chat.",
      });
    }

    const { subject, message, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and initial message are required.",
      });
    }

    // Find admin user - get the first admin
    let admin;
    try {
      admin = await User.findOne({ role: "admin" });
      if (!admin) {
        console.error(
          "No admin user found in database. Please create an admin user."
        );
        return res.status(500).json({
          success: false,
          message:
            "Support system is not available. Please contact support directly.",
          error: "No admin user found",
        });
      }
      console.log("Found admin user:", admin._id, admin.name);
    } catch (dbError) {
      console.error("Database error finding admin user:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error. Please try again later.",
        error:
          process.env.NODE_ENV === "development" ? dbError.message : undefined,
      });
    }

    // Check if user already has an open support chat
    const existingChat = await Chat.findOne({
      chatType: "support",
      participants: { $all: [req.user._id, admin._id] },
      status: "open",
    });

    console.log(
      "Looking for existing chat between user:",
      req.user._id,
      "and admin:",
      admin._id
    );
    console.log("Found existing chat:", existingChat?._id);

    if (existingChat) {
      // Add message to existing chat
      const newMessage = await Message.create({
        chat: existingChat._id,
        sender: req.user._id,
        message: message,
        messageType: "text",
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
        const { generateChatbotResponse } = await import("../utils/chatbot.js");
        const chatbotResponse = await generateChatbotResponse(
          message,
          existingChat._id
        );
        if (chatbotResponse) {
          const botMessage = await Message.create({
            chat: existingChat._id,
            sender: null,
            message: chatbotResponse,
            messageType: "text",
            isBot: true,
          });

          existingChat.lastMessage = chatbotResponse;
          existingChat.lastMessageAt = new Date();
          await existingChat.save();

          // Emit bot message via socket if available
          const io = req.app.get("io");
          if (io) {
            io.to(`chat:${existingChat._id}`).emit("new-message", {
              message: botMessage,
              chat: existingChat,
              chatId: existingChat._id,
            });
          }
        }
      } catch (botError) {
        console.error("Chatbot error:", botError);
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
          message: newMessage,
        },
      });
    }

    // Create new support chat
    const chat = await Chat.create({
      participants: [req.user._id, admin._id],
      chatType: "support",
      subject: subject,
      priority: priority || "medium",
      status: "open",
      lastMessage: message,
      lastMessageAt: new Date(),
      unreadCount: new Map([[admin._id.toString(), 1]]),
    });

    // Create initial message
    const initialMessage = await Message.create({
      chat: chat._id,
      sender: req.user._id,
      message: message,
      messageType: "text",
    });

    // Update chat with initial message
    chat.lastMessage = message;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Get populated chat for response
    const populatedChat = await Chat.findById(chat._id).populate(
      "participants",
      "name email avatar role"
    );

    // Emit new chat notification to admin room
    const io = req.app.get("io");
    if (io) {
      io.to("admin:room").emit("new-support-chat", {
        chat: populatedChat,
        message: initialMessage,
        userName: req.user.name,
      });
    }

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
        message: initialMessage,
      },
    });
  } catch (error) {
    console.error("Create Support Chat Error:", error);
    console.error("Error stack:", error.stack);

    // Provide more specific error messages
    let errorMessage = "Server error. Please try again later.";
    if (error.name === "ValidationError") {
      errorMessage = "Invalid data provided. Please check your input.";
    } else if (error.name === "CastError") {
      errorMessage = "Invalid ID format.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message: "Unauthorized.",
      });
    }

    const chats = await Chat.find({
      chatType: "support",
      participants: req.user._id,
    })
      .populate("participants", "name email avatar role")
      .sort({ lastMessageAt: -1 });

    // Convert Maps to objects for JSON serialization
    const chatsData = chats.map((chat) => {
      const chatObj = chat.toObject();
      if (chatObj.unreadCount instanceof Map) {
        chatObj.unreadCount = Object.fromEntries(chatObj.unreadCount);
      }
      return chatObj;
    });

    return res.status(200).json({
      success: true,
      message: "Support chats retrieved successfully.",
      data: chatsData,
    });
  } catch (error) {
    console.error("Get User Support Chats Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message: "Unauthorized.",
      });
    }

    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID.",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found.",
      });
    }

    // Check if user is participant (allow admins to access any chat)
    if (
      req.user.role !== "admin" &&
      !chat.participants.includes(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this chat.",
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
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    // Update unread count
    chat.unreadCount.set(req.user._id.toString(), 0);
    await chat.save();

    return res.status(200).json({
      success: true,
      message: "Messages retrieved successfully.",
      data: messages,
    });
  } catch (error) {
    console.error("Get Support Chat Messages Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message: "Unauthorized.",
      });
    }

    const { chatId } = req.params;
    const { message, messageType = "text", attachments = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID.",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found.",
      });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this chat.",
      });
    }

    // Handle file uploads if any
    let uploadedAttachments = [];
    if (req.files && req.files.length > 0) {
      const { uploadCloudinary } = await import("../utils/cloudinary.js");
      uploadedAttachments = await Promise.all(
        req.files.map(async (file) => {
          try {
            const url = await uploadCloudinary(file.buffer);
            return url;
          } catch (err) {
            // Import Logger dynamically to avoid circular dependencies
            const Logger = (await import("../utils/logger.js")).default;
            Logger.error("Error uploading attachment in support chat", err);
            return null;
          }
        })
      );
      uploadedAttachments = uploadedAttachments.filter((url) => url);
    }

    // Create message
    const newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      message: message.trim(),
      messageType: messageType,
      attachments:
        uploadedAttachments.length > 0
          ? uploadedAttachments
          : attachments || [],
    });

    // Update chat
    chat.lastMessage = message.trim();
    chat.lastMessageAt = new Date();
    chat.isActive = true;
    if (chat.status === "closed") {
      chat.status = "open"; // Reopen if closed
    }

    // Update unread count for other participants
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        const currentUnread =
          chat.unreadCount.get(participantId.toString()) || 0;
        chat.unreadCount.set(participantId.toString(), currentUnread + 1);
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "sender",
      "name email avatar role"
    );

    // Emit user message via socket if available
    const io = req.app.get("io");
    if (io) {
      console.log(
        `Emitting message to chat:${chatId}, participants:`,
        chat.participants
      );

      // Emit to the specific chat room (for users who have joined)
      io.to(`chat:${chatId}`).emit("new-message", {
        message: populatedMessage,
        chat: chat,
        chatId: chatId,
      });

      // Also emit to admin room for real-time notifications
      io.to("admin:room").emit("new-support-message", {
        message: populatedMessage,
        chat: chat,
        chatId: chatId,
        userName: req.user.name,
      });
    } else {
      console.log("Socket.io not available for message emission");
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send Support Message Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/*
 * Get All Support Chats (Admin)
 */
export const getAllSupportChats = async (req, res) => {
  try {
    console.log(
      "getAllSupportChats called by admin:",
      req.user._id,
      req.user.name
    );
    console.log("Admin permissions:", req.user.permissions);
    console.log("Admin role:", req.user.role);

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all support chats.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, priority, search } = req.query;

    const query = { chatType: "support" };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    console.log("Admin chat query:", query);
    const totalChats = await Chat.countDocuments(query);
    console.log("Total support chats found:", totalChats);

    let chats = await Chat.find(query)
      .populate("participants", "name email avatar role")
      .skip(skip)
      .limit(limit)
      .sort({ lastMessageAt: -1 });

    console.log("Raw chats found:", chats.length);
    console.log(
      "First chat data sample:",
      chats[0]
        ? {
            _id: chats[0]._id,
            participants: chats[0].participants,
            lastMessage: chats[0].lastMessage,
            chatType: chats[0].chatType,
          }
        : "No chats found"
    );

    // Enhance chat data with user information for better frontend handling
    const enhancedChats = chats.map((chat) => {
      const chatObj = chat.toObject();

      // Debug: Log participant data
      console.log(
        `Chat ${chatObj._id} participants:`,
        chatObj.participants.map((p) => ({
          id: p._id,
          name: p.name,
          role: p.role,
          email: p.email,
        }))
      );

      // Simple approach: Find the user who is NOT the current admin
      let userParticipant = null;

      if (chatObj.participants && chatObj.participants.length > 0) {
        // First try to find someone who is not an admin
        userParticipant = chatObj.participants.find((p) => p.role !== "admin");

        // If no non-admin found, find someone who is not the current admin
        if (!userParticipant) {
          userParticipant = chatObj.participants.find(
            (p) => p._id && p._id.toString() !== req.user._id.toString()
          );
        }

        // Last resort: use the first participant
        if (!userParticipant && chatObj.participants.length > 0) {
          userParticipant = chatObj.participants[0];
        }
      }

      // Add user field for easier frontend access
      chatObj.user = userParticipant;
      chatObj.customerName = userParticipant?.name || "Unknown User";

      console.log(`Final result for chat ${chatObj._id}:`, {
        userName: chatObj.user?.name,
        customerName: chatObj.customerName,
        userRole: chatObj.user?.role,
      });

      return chatObj;
    });

    // Filter by search if provided
    let filteredChats = enhancedChats;
    if (search) {
      filteredChats = enhancedChats.filter((chat) => {
        const participantNames = chat.participants
          .filter((p) => p.role !== "admin")
          .map((p) => p.name)
          .join(" ");
        const subject = chat.subject || "";
        const customerName = chat.customerName || "";
        return (
          participantNames.toLowerCase().includes(search.toLowerCase()) ||
          subject.toLowerCase().includes(search.toLowerCase()) ||
          customerName.toLowerCase().includes(search.toLowerCase())
        );
      });
    }

    const total = await Chat.countDocuments(query);

    // Convert Maps to objects for JSON serialization
    const chatsData = filteredChats.map((chat) => {
      const chatObj = { ...chat };
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
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get All Support Chats Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Send Admin Response (Admin)
 */
export const sendAdminResponse = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can send responses.",
      });
    }

    const { chatId } = req.params;
    const { message, messageType = "text", attachments = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID.",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || chat.chatType !== "support") {
      return res.status(404).json({
        success: false,
        message: "Support chat not found.",
      });
    }

    // Handle file uploads if any
    let uploadedAttachments = [];
    if (req.files && req.files.length > 0) {
      const { uploadCloudinary } = await import("../utils/cloudinary.js");
      uploadedAttachments = await Promise.all(
        req.files.map(async (file) => {
          try {
            const url = await uploadCloudinary(file.buffer);
            return url;
          } catch (err) {
            // Import Logger dynamically to avoid circular dependencies
            const Logger = (await import("../utils/logger.js")).default;
            Logger.error("Error uploading attachment in support chat", err);
            return null;
          }
        })
      );
      uploadedAttachments = uploadedAttachments.filter((url) => url);
    }

    // Create message
    const newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      message: message.trim(),
      messageType: messageType,
      attachments:
        uploadedAttachments.length > 0
          ? uploadedAttachments
          : attachments || [],
    });

    // Update chat
    chat.lastMessage = message.trim();
    chat.lastMessageAt = new Date();
    chat.isActive = true;

    // Update unread count for user (not admin)
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        const currentUnread =
          chat.unreadCount.get(participantId.toString()) || 0;
        chat.unreadCount.set(participantId.toString(), currentUnread + 1);
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "sender",
      "name email avatar role"
    );

    // Emit admin message via socket if available
    const io = req.app.get("io");
    if (io) {
      // Emit to the specific chat room
      io.to(`chat:${chatId}`).emit("new-message", {
        message: populatedMessage,
        chat: chat,
        chatId: chatId,
      });

      // Also emit to admin room for real-time updates
      io.to("admin:room").emit("new-support-message", {
        message: populatedMessage,
        chat: chat,
        chatId: chatId,
        userName: req.user.name,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Response sent successfully.",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send Admin Response Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update Support Chat Status (Admin)
 */
export const updateSupportChatStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update chat status.",
      });
    }

    const { chatId } = req.params;
    const { status, priority } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID.",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || chat.chatType !== "support") {
      return res.status(404).json({
        success: false,
        message: "Support chat not found.",
      });
    }

    if (status && ["open", "resolved", "closed"].includes(status)) {
      chat.status = status;
    }
    if (priority && ["low", "medium", "high", "urgent"].includes(priority)) {
      chat.priority = priority;
    }

    await chat.save();

    return res.status(200).json({
      success: true,
      message: "Chat status updated successfully.",
      data: chat,
    });
  } catch (error) {
    console.error("Update Support Chat Status Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete Support Chat (Admin)
 */
export const deleteSupportChat = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete support chats.",
      });
    }

    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID.",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || chat.chatType !== "support") {
      return res.status(404).json({
        success: false,
        message: "Support chat not found.",
      });
    }

    // Delete all messages associated with this chat
    await Message.deleteMany({ chat: chatId });

    // Delete the chat
    await chat.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Support chat and all messages deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Support Chat Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create Admin Chat with User (Admin)
 */
export const createAdminChatWithUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can start chats with users.",
      });
    }

    const { userId } = req.params;
    const { subject, message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check if chat already exists between admin and this user
    const existingChat = await Chat.findOne({
      chatType: "support",
      participants: { $all: [req.user._id, targetUser._id] },
      status: { $in: ["open", "active"] },
    }).populate("participants", "name email avatar role");

    if (existingChat) {
      return res.status(200).json({
        success: true,
        message: "Chat already exists.",
        data: existingChat,
      });
    }

    // Create new chat
    const chat = await Chat.create({
      participants: [req.user._id, targetUser._id],
      chatType: "support",
      subject: subject || `Support Chat with ${targetUser.name}`,
      priority: "medium",
      status: "open",
      lastMessage:
        message || "Hello! I'm from the support team. How can I help you?",
      lastMessageAt: new Date(),
      unreadCount: new Map([[targetUser._id.toString(), 1]]),
    });

    // Create initial message from admin if provided
    if (message && message.trim()) {
      await Message.create({
        chat: chat._id,
        sender: req.user._id,
        message: message.trim(),
        messageType: "text",
      });
    }

    // Populate and return
    const populatedChat = await Chat.findById(chat._id).populate(
      "participants",
      "name email avatar role"
    );

    // Convert Map to object for JSON serialization
    const chatData = populatedChat.toObject();
    if (chatData.unreadCount instanceof Map) {
      chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
    }

    return res.status(201).json({
      success: true,
      message: "Chat created successfully.",
      data: chatData,
    });
  } catch (error) {
    console.error("Create Admin Chat Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Support Chat Messages for Admin (Admin)
 */
export const getSupportChatMessagesAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view support chat messages.",
      });
    }

    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID.",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found.",
      });
    }

    const messages = await Message.find({ chat: chatId, isDeleted: false })
      .populate("sender", "name email avatar role")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      message: "Messages retrieved successfully.",
      data: { messages },
    });
  } catch (error) {
    console.error("Get Support Chat Messages Admin Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message: "Unauthorized.",
      });
    }

    const { messageId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID.",
      });
    }

    const messageDoc = await Message.findById(messageId);
    if (!messageDoc) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    // Check if message is deleted
    if (messageDoc.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit deleted message.",
      });
    }

    // Check if user is the sender (users can only edit their own messages)
    if (messageDoc.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages.",
      });
    }

    // Check if user is participant in the chat
    const chat = await Chat.findById(messageDoc.chat);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found.",
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this chat.",
      });
    }

    // Update message
    messageDoc.message = message.trim();
    messageDoc.editedAt = new Date();
    messageDoc.isEdited = true;
    await messageDoc.save();

    // Update chat last message if this was the last message
    if (
      chat.lastMessage === messageDoc.message ||
      chat._id.toString() === messageDoc.chat.toString()
    ) {
      chat.lastMessage = message.trim();
      await chat.save();
    }

    const populatedMessage = await Message.findById(messageDoc._id).populate(
      "sender",
      "name email avatar role"
    );

    // Emit via socket if available
    const io = req.app.get("io");
    if (io) {
      io.to(`chat:${messageDoc.chat}`).emit("message-updated", {
        message: populatedMessage,
        chatId: messageDoc.chat,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message updated successfully.",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Edit Support Message Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteSupportMessage = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID.",
      });
    }

    const messageDoc = await Message.findById(messageId);
    if (!messageDoc) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    // Check if message is already deleted
    if (messageDoc.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Message is already deleted.",
      });
    }

    // Check if user is the sender (users can only delete their own messages)
    if (messageDoc.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages.",
      });
    }

    // Check if user is participant in the chat
    const chat = await Chat.findById(messageDoc.chat);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found.",
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this chat.",
      });
    }

    // Soft delete
    messageDoc.isDeleted = true;
    messageDoc.deletedAt = new Date();
    await messageDoc.save();

    // Emit via socket if available
    const io = req.app.get("io");
    if (io) {
      io.to(`chat:${messageDoc.chat}`).emit("message-deleted", {
        messageId: messageDoc._id,
        chatId: messageDoc.chat,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Support Message Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
