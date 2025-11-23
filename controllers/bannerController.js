import Banner from '../models/bannerModel.js';
import mongoose from 'mongoose';
import { uploadCloudinary } from '../utils/cloudinary.js';

/**
 * Create Banner
 */
export const createBanner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create banners."
            });
        }

        const { title, linkUrl, type, position, isActive, order, startDate, endDate } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Title is required."
            });
        }

        // Handle image upload
        let imageUrl = null;
        if (req.file) {
            try {
                imageUrl = await uploadCloudinary(req.file.buffer);
            } catch (error) {
                console.error("Error uploading image:", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload image."
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Banner image is required."
            });
        }

        const banner = await Banner.create({
            title: title.trim(),
            image: imageUrl,
            linkUrl: linkUrl || null,
            type: type || "homepage",
            position: position || "hero",
            isActive: isActive !== undefined ? isActive : true,
            order: order || 0,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Banner created successfully.",
            data: banner
        });
    } catch (error) {
        console.error("Create Banner Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Banners
 */
export const getAllBanners = async (req, res) => {
    try {
        const { type, isActive, position } = req.query;
        const query = {};

        if (type) query.type = type;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (position) query.position = position;

        const banners = await Banner.find(query)
            .populate("createdBy", "name email")
            .sort({ order: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Banners retrieved successfully.",
            data: banners
        });
    } catch (error) {
        console.error("Get All Banners Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Banner
 */
export const getBannerById = async (req, res) => {
    try {
        const { bannerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(bannerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid banner ID."
            });
        }

        const banner = await Banner.findById(bannerId)
            .populate("createdBy", "name email");

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: "Banner not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Banner retrieved successfully.",
            data: banner
        });
    } catch (error) {
        console.error("Get Banner Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Banner
 */
export const updateBanner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update banners."
            });
        }

        const { bannerId } = req.params;
        const { title, linkUrl, type, position, isActive, order, startDate, endDate } = req.body;

        if (!mongoose.Types.ObjectId.isValid(bannerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid banner ID."
            });
        }

        const banner = await Banner.findById(bannerId);
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: "Banner not found."
            });
        }

        // Update fields
        if (title) banner.title = title.trim();
        if (linkUrl !== undefined) banner.linkUrl = linkUrl || null;
        if (type) banner.type = type;
        if (position) banner.position = position;
        if (isActive !== undefined) banner.isActive = isActive;
        if (order !== undefined) banner.order = order;
        if (startDate) banner.startDate = new Date(startDate);
        if (endDate !== undefined) banner.endDate = endDate ? new Date(endDate) : null;

        // Handle image update
        if (req.file) {
            try {
                banner.image = await uploadCloudinary(req.file.buffer);
            } catch (error) {
                console.error("Error uploading image:", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload image."
                });
            }
        }

        await banner.save();

        return res.status(200).json({
            success: true,
            message: "Banner updated successfully.",
            data: banner
        });
    } catch (error) {
        console.error("Update Banner Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Banner
 */
export const deleteBanner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete banners."
            });
        }

        const { bannerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(bannerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid banner ID."
            });
        }

        const banner = await Banner.findById(bannerId);
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: "Banner not found."
            });
        }

        await banner.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Banner deleted successfully."
        });
    } catch (error) {
        console.error("Delete Banner Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

