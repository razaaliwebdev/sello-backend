import Testimonial from '../models/testimonialModel.js';
import mongoose from 'mongoose';
import { uploadCloudinary } from '../utils/cloudinary.js';

/**
 * Create Testimonial
 */
export const createTestimonial = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create testimonials."
            });
        }

        const { name, role, company, text, rating, isActive, order, featured } = req.body;

        if (!name || !text) {
            return res.status(400).json({
                success: false,
                message: "Name and text are required."
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
        }

        const testimonial = await Testimonial.create({
            name: name.trim(),
            role: role || "",
            company: company || "",
            image: imageUrl,
            text: text.trim(),
            rating: rating || 5,
            isActive: isActive !== undefined ? isActive : true,
            order: order || 0,
            featured: featured || false,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Testimonial created successfully.",
            data: testimonial
        });
    } catch (error) {
        console.error("Create Testimonial Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Testimonials
 */
export const getAllTestimonials = async (req, res) => {
    try {
        const { isActive, featured } = req.query;
        const query = {};

        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (featured !== undefined) query.featured = featured === 'true';

        const testimonials = await Testimonial.find(query)
            .populate("createdBy", "name email")
            .sort({ order: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Testimonials retrieved successfully.",
            data: testimonials
        });
    } catch (error) {
        console.error("Get All Testimonials Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Testimonial
 */
export const getTestimonialById = async (req, res) => {
    try {
        const { testimonialId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(testimonialId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid testimonial ID."
            });
        }

        const testimonial = await Testimonial.findById(testimonialId)
            .populate("createdBy", "name email");

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: "Testimonial not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Testimonial retrieved successfully.",
            data: testimonial
        });
    } catch (error) {
        console.error("Get Testimonial Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Testimonial
 */
export const updateTestimonial = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update testimonials."
            });
        }

        const { testimonialId } = req.params;
        const { name, role, company, text, rating, isActive, order, featured } = req.body;

        if (!mongoose.Types.ObjectId.isValid(testimonialId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid testimonial ID."
            });
        }

        const testimonial = await Testimonial.findById(testimonialId);
        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: "Testimonial not found."
            });
        }

        // Update fields
        if (name) testimonial.name = name.trim();
        if (role !== undefined) testimonial.role = role || "";
        if (company !== undefined) testimonial.company = company || "";
        if (text) testimonial.text = text.trim();
        if (rating !== undefined) testimonial.rating = rating;
        if (isActive !== undefined) testimonial.isActive = isActive;
        if (order !== undefined) testimonial.order = order;
        if (featured !== undefined) testimonial.featured = featured;

        // Handle image update
        if (req.file) {
            try {
                testimonial.image = await uploadCloudinary(req.file.buffer);
            } catch (error) {
                console.error("Error uploading image:", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload image."
                });
            }
        }

        await testimonial.save();

        return res.status(200).json({
            success: true,
            message: "Testimonial updated successfully.",
            data: testimonial
        });
    } catch (error) {
        console.error("Update Testimonial Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Testimonial
 */
export const deleteTestimonial = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete testimonials."
            });
        }

        const { testimonialId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(testimonialId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid testimonial ID."
            });
        }

        const testimonial = await Testimonial.findById(testimonialId);
        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: "Testimonial not found."
            });
        }

        await testimonial.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Testimonial deleted successfully."
        });
    } catch (error) {
        console.error("Delete Testimonial Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

