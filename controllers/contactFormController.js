import ContactForm from '../models/contactFormModel.js';
import { Chat, Message } from '../models/chatModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import bcrypt from 'bcrypt';

/**
 * Submit Contact Form
 */
export const submitContactForm = async (req, res) => {
    try {
        const { firstName, lastName, email, subject, message } = req.body;

        if (!firstName || !lastName || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const contactForm = await ContactForm.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            subject: subject.trim(),
            message: message.trim(),
            status: 'new'
        });

        return res.status(201).json({
            success: true,
            message: "Contact form submitted successfully. We'll get back to you soon!",
            data: contactForm
        });
    } catch (error) {
        Logger.error("Submit Contact Form Error", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Contact Forms (Admin)
 */
export const getAllContactForms = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view contact forms."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { status, search } = req.query;

        const query = {};
        if (status && ['new', 'in_progress', 'resolved'].includes(status)) {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ];
        }

        const contactForms = await ContactForm.find(query)
            .populate('resolvedBy', 'name email')
            .populate('chatId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ContactForm.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Contact forms retrieved successfully.",
            data: {
                contactForms,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        Logger.error("Get All Contact Forms Error", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Contact Form (Admin)
 */
export const getContactFormById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view contact forms."
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid contact form ID."
            });
        }

        const contactForm = await ContactForm.findById(id)
            .populate('resolvedBy', 'name email')
            .populate('chatId');

        if (!contactForm) {
            return res.status(404).json({
                success: false,
                message: "Contact form not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Contact form retrieved successfully.",
            data: contactForm
        });
    } catch (error) {
        Logger.error("Get Contact Form Error", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Convert Contact Form to Chat (Admin)
 */
export const convertToChat = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can convert contact forms to chats."
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid contact form ID."
            });
        }

        const contactForm = await ContactForm.findById(id);
        if (!contactForm) {
            return res.status(404).json({
                success: false,
                message: "Contact form not found."
            });
        }

        // Check if already converted
        if (contactForm.chatId) {
            return res.status(400).json({
                success: false,
                message: "This contact form has already been converted to a chat.",
                data: { chatId: contactForm.chatId }
            });
        }

        // Find or create user by email
        let user = await User.findOne({ email: contactForm.email });
        if (!user) {
            try {
                // Generate a secure temporary password (minimum 6 characters required)
                const tempPassword = `Temp${Date.now()}${Math.random().toString(36).slice(2)}`;
                
                // Hash the password (required for User model)
                const hashedPassword = await bcrypt.hash(tempPassword, 12);
                
                // Create user if doesn't exist
                // Use 'individual' role (valid enum value) instead of 'buyer'
                user = await User.create({
                    name: `${contactForm.firstName} ${contactForm.lastName}`,
                    email: contactForm.email.toLowerCase().trim(),
                    password: hashedPassword, // Hashed temporary password (user will need to reset)
                    role: 'individual', // Valid enum: 'individual', 'dealer', or 'admin'
                    status: 'active',
                    verified: false
                });
            } catch (userError) {
                console.error("Error creating user:", userError);
                // If user creation fails (e.g., email already exists, validation error), try to find again
                user = await User.findOne({ email: contactForm.email.toLowerCase().trim() });
                if (!user) {
                    throw new Error(`Failed to create or find user: ${userError.message}`);
                }
            }
        }

        // Create support chat
        let chat;
        try {
            chat = await Chat.create({
                participants: [user._id, req.user._id],
                chatType: 'support',
                subject: contactForm.subject || 'Support Request',
                priority: 'medium',
                status: 'open',
                lastMessage: contactForm.message || 'No message',
                lastMessageAt: new Date(),
                unreadCount: new Map([[user._id.toString(), 0], [req.user._id.toString(), 0]])
            });
        } catch (chatError) {
            console.error("Error creating chat:", chatError);
            throw new Error(`Failed to create chat: ${chatError.message}`);
        }

        // Create initial message from contact form
        try {
            await Message.create({
                chat: chat._id,
                sender: user._id,
                message: contactForm.message || 'No message',
                messageType: 'text'
            });
        } catch (messageError) {
            console.error("Error creating message:", messageError);
            // If message creation fails, delete the chat to maintain consistency
            await Chat.findByIdAndDelete(chat._id);
            throw new Error(`Failed to create message: ${messageError.message}`);
        }

        // Update contact form
        contactForm.chatId = chat._id;
        contactForm.status = 'in_progress';
        await contactForm.save();

        const populatedChat = await Chat.findById(chat._id)
            .populate("participants", "name email avatar role");

        // Convert Map to object
        const chatData = populatedChat.toObject();
        if (chatData.unreadCount instanceof Map) {
            chatData.unreadCount = Object.fromEntries(chatData.unreadCount);
        }

        return res.status(200).json({
            success: true,
            message: "Contact form converted to chat successfully.",
            data: {
                chat: chatData,
                contactForm
            }
        });
    } catch (error) {
        console.error("Convert to Chat Error:", error);
        console.error("Error stack:", error.stack);
        
        // Provide more specific error messages
        let errorMessage = "Server error. Please try again later.";
        if (error.name === 'ValidationError') {
            errorMessage = `Validation error: ${error.message}`;
        } else if (error.name === 'CastError') {
            errorMessage = "Invalid ID format.";
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        Logger.error("Convert to Chat Error", error);
        return res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Contact Form Status (Admin)
 */
export const updateContactFormStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update contact form status."
            });
        }

        const { id } = req.params;
        const { status, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid contact form ID."
            });
        }

        const contactForm = await ContactForm.findById(id);
        if (!contactForm) {
            return res.status(404).json({
                success: false,
                message: "Contact form not found."
            });
        }

        if (status && ['new', 'in_progress', 'resolved'].includes(status)) {
            contactForm.status = status;
            if (status === 'resolved') {
                contactForm.resolvedAt = new Date();
                contactForm.resolvedBy = req.user._id;
            }
        }

        if (notes !== undefined) {
            contactForm.notes = notes;
        }

        await contactForm.save();

        return res.status(200).json({
            success: true,
            message: "Contact form status updated successfully.",
            data: contactForm
        });
    } catch (error) {
        Logger.error("Update Contact Form Status Error", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Contact Form (Admin)
 */
export const deleteContactForm = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete contact forms."
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid contact form ID."
            });
        }

        const contactForm = await ContactForm.findById(id);
        if (!contactForm) {
            return res.status(404).json({
                success: false,
                message: "Contact form not found."
            });
        }

        await contactForm.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Contact form deleted successfully."
        });
    } catch (error) {
        Logger.error("Delete Contact Form Error", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

