import Verification from '../models/verificationModel.js';
import User from '../models/userModel.js';
import { uploadCloudinary } from '../utils/cloudinary.js';
import Logger from '../utils/logger.js';

/**
 * Submit verification documents
 */
export const submitVerification = async (req, res) => {
    try {
        const { documentType } = req.body;
        const userId = req.user._id;

        if (!documentType) {
            return res.status(400).json({
                success: false,
                message: 'Document type is required'
            });
        }

        if (!req.files || !req.files.frontDocument || !req.files.frontDocument[0]) {
            return res.status(400).json({
                success: false,
                message: 'Front document image is required'
            });
        }

        // Upload documents
        const frontDocUrl = await uploadCloudinary(req.files.frontDocument[0].buffer, {
            folder: 'sello_verifications'
        });
        
        const backDocUrl = req.files.backDocument && req.files.backDocument[0]
            ? await uploadCloudinary(req.files.backDocument[0].buffer, {
                folder: 'sello_verifications'
            })
            : null;

        // Create or update verification request
        const verification = await Verification.findOneAndUpdate(
            { user: userId },
            {
                user: userId,
                documentType,
                frontDocument: frontDocUrl,
                backDocument: backDocUrl,
                status: 'pending',
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
                submittedAt: new Date()
            },
            { upsert: true, new: true }
        ).populate('user', 'name email');

        Logger.info(`User ${userId} submitted verification documents`, { verificationId: verification._id });

        return res.status(200).json({
            success: true,
            message: 'Verification documents submitted successfully. Please wait for admin review.',
            data: verification
        });
    } catch (error) {
        Logger.error('Error submitting verification', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error submitting verification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Admin: Review verification
 */
export const reviewVerification = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can review verifications'
            });
        }

        const { verificationId } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either "approved" or "rejected"'
            });
        }

        const verification = await Verification.findById(verificationId).populate('user');
        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Verification not found'
            });
        }

        verification.status = status;
        verification.reviewedBy = req.user._id;
        verification.reviewedAt = new Date();
        if (status === 'rejected' && rejectionReason) {
            verification.rejectionReason = rejectionReason;
        } else if (status === 'approved') {
            verification.rejectionReason = null;
        }

        await verification.save();

        // Update user verification status
        if (status === 'approved') {
            await User.findByIdAndUpdate(verification.user._id, {
                isVerified: true
            });
        } else if (status === 'rejected') {
            // Keep isVerified as false if rejected
            await User.findByIdAndUpdate(verification.user._id, {
                isVerified: false
            });
        }

        Logger.info(`Admin ${req.user._id} ${status} verification ${verificationId}`);

        return res.status(200).json({
            success: true,
            message: `Verification ${status} successfully`,
            data: verification
        });
    } catch (error) {
        Logger.error('Error reviewing verification', error, { 
            userId: req.user?._id, 
            verificationId: req.params.verificationId 
        });
        return res.status(500).json({
            success: false,
            message: 'Error reviewing verification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get user's verification status
 */
export const getVerificationStatus = async (req, res) => {
    try {
        const verification = await Verification.findOne({ user: req.user._id })
            .populate('reviewedBy', 'name email')
            .populate('user', 'name email isVerified');
        
        return res.status(200).json({
            success: true,
            data: verification || { status: 'not_submitted', user: { isVerified: false } }
        });
    } catch (error) {
        Logger.error('Error fetching verification status', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error fetching verification status'
        });
    }
};

/**
 * Get all verifications (Admin only)
 */
export const getAllVerifications = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view all verifications'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { status } = req.query;

        const filter = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            filter.status = status;
        }

        const verifications = await Verification.find(filter)
            .populate('user', 'name email role isVerified')
            .populate('reviewedBy', 'name email')
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Verification.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: {
                verifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        Logger.error('Error fetching all verifications', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error fetching verifications'
        });
    }
};
