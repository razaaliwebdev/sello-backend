import mongoose from 'mongoose';
import CustomerRequest from '../models/customerRequestModel.js';
import User from '../models/userModel.js';

/**
 * Get All Customer Requests (Admin)
 */
export const getAllCustomerRequests = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all customer requests."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { status, priority, type, search, assignedTo } = req.query;

        const query = {};
        if (status && status !== 'all') query.status = status;
        if (priority) query.priority = priority;
        if (type) query.type = type;
        if (assignedTo) query.assignedTo = assignedTo;

        let requests = await CustomerRequest.find(query)
            .populate("user", "name email avatar")
            .populate("assignedTo", "name email avatar")
            .populate("resolvedBy", "name email")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Filter by search if provided
        if (search) {
            requests = requests.filter(request => {
                const searchLower = search.toLowerCase();
                const userName = request.user?.name || "";
                const subject = request.subject || "";
                const description = request.description || "";
                const requestId = request._id.toString();
                return userName.toLowerCase().includes(searchLower) ||
                       subject.toLowerCase().includes(searchLower) ||
                       description.toLowerCase().includes(searchLower) ||
                       requestId.includes(searchLower);
            });
        }

        const total = await CustomerRequest.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Customer requests retrieved successfully.",
            data: {
                requests,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Customer Requests Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Customer Request by ID
 */
export const getCustomerRequestById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view customer requests."
            });
        }

        const { requestId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID."
            });
        }

        const request = await CustomerRequest.findById(requestId)
            .populate("user", "name email avatar phone")
            .populate("assignedTo", "name email avatar")
            .populate("resolvedBy", "name email")
            .populate("responses.responder", "name email avatar");

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Customer request not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer request retrieved successfully.",
            data: request
        });
    } catch (error) {
        console.error("Get Customer Request Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create Customer Request (User)
 */
export const createCustomerRequest = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login to create a request."
            });
        }

        const { type, subject, description, priority, attachments, tags } = req.body;

        if (!subject || !description) {
            return res.status(400).json({
                success: false,
                message: "Subject and description are required."
            });
        }

        const request = await CustomerRequest.create({
            user: req.user._id,
            type: type || 'support',
            subject: subject.trim(),
            description: description.trim(),
            priority: priority || 'medium',
            attachments: attachments || [],
            tags: tags || []
        });

        const populated = await CustomerRequest.findById(request._id)
            .populate("user", "name email avatar");

        return res.status(201).json({
            success: true,
            message: "Customer request created successfully.",
            data: populated
        });
    } catch (error) {
        console.error("Create Customer Request Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Customer Request (Admin)
 */
export const updateCustomerRequest = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update customer requests."
            });
        }

        const { requestId } = req.params;
        const { status, priority, assignedTo, tags } = req.body;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID."
            });
        }

        const request = await CustomerRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Customer request not found."
            });
        }

        if (status) {
            request.status = status;
            if (status === 'resolved') {
                request.resolvedAt = new Date();
                request.resolvedBy = req.user._id;
            }
        }
        if (priority) request.priority = priority;
        if (assignedTo) request.assignedTo = assignedTo;
        if (tags) request.tags = tags;

        await request.save();

        const populated = await CustomerRequest.findById(request._id)
            .populate("user", "name email avatar")
            .populate("assignedTo", "name email avatar")
            .populate("resolvedBy", "name email");

        return res.status(200).json({
            success: true,
            message: "Customer request updated successfully.",
            data: populated
        });
    } catch (error) {
        console.error("Update Customer Request Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Add Response to Customer Request (Admin)
 */
export const addResponse = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can respond to customer requests."
            });
        }

        const { requestId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Response message is required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID."
            });
        }

        const request = await CustomerRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Customer request not found."
            });
        }

        request.responses.push({
            responder: req.user._id,
            message: message.trim()
        });

        // Update status to in_progress if it was open
        if (request.status === 'open') {
            request.status = 'in_progress';
        }

        await request.save();

        const populated = await CustomerRequest.findById(request._id)
            .populate("user", "name email avatar")
            .populate("assignedTo", "name email avatar")
            .populate("responses.responder", "name email avatar");

        return res.status(200).json({
            success: true,
            message: "Response added successfully.",
            data: populated
        });
    } catch (error) {
        console.error("Add Response Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Customer Request (Admin)
 */
export const deleteCustomerRequest = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete customer requests."
            });
        }

        const { requestId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID."
            });
        }

        const request = await CustomerRequest.findByIdAndDelete(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Customer request not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer request deleted successfully."
        });
    } catch (error) {
        console.error("Delete Customer Request Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Customer Request Statistics
 */
export const getCustomerRequestStatistics = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view customer request statistics."
            });
        }

        const [
            openRequests,
            inProgressRequests,
            totalRequests,
            resolvedRequests
        ] = await Promise.all([
            CustomerRequest.countDocuments({ status: 'open' }),
            CustomerRequest.countDocuments({ status: 'in_progress' }),
            CustomerRequest.countDocuments(),
            CustomerRequest.countDocuments({ status: 'resolved' })
        ]);

        return res.status(200).json({
            success: true,
            message: "Customer request statistics retrieved successfully.",
            data: {
                openRequests,
                inProgressRequests,
                totalRequests,
                resolvedRequests
            }
        });
    } catch (error) {
        console.error("Get Customer Request Statistics Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

