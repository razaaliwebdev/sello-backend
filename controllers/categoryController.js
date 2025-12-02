import Category from '../models/categoryModel.js';
import mongoose from 'mongoose';
import { uploadCloudinary } from '../utils/cloudinary.js';

/**
 * Create Category
 */
export const createCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create categories."
            });
        }

        const { name, description, image, type, subType, parentCategory, order, isActive } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                message: "Name and type are required."
            });
        }

        // Handle image upload
        let imageUrl = image || null;
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

        // Validate subType for car categories
        if (type === 'car' && subType && !['make', 'model', 'year'].includes(subType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid subType for car category. Must be 'make', 'model', or 'year'."
            });
        }

        // Validate subType for location categories
        if (type === 'location' && subType && !['country', 'city', 'state'].includes(subType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid subType for location category. Must be 'country', 'city', or 'state'."
            });
        }

        // Validate parentCategory if provided
        if (parentCategory) {
            if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid parent category ID."
                });
            }
            const parent = await Category.findById(parentCategory);
            if (!parent) {
                return res.status(404).json({
                    success: false,
                    message: "Parent category not found."
                });
            }
            // Models must have a make as parent
            if (subType === 'model' && parent.subType !== 'make') {
                return res.status(400).json({
                    success: false,
                    message: "Model categories must have a make category as parent."
                });
            }
            // Cities (and states) must have a country as parent
            if (['city', 'state'].includes(subType) && parent.subType !== 'country') {
                return res.status(400).json({
                    success: false,
                    message: "City and state categories must have a country category as parent."
                });
            }
        }

        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check if category already exists (considering type, subType, and parent)
        const query = { slug, type };
        if (subType) query.subType = subType;
        if (parentCategory) query.parentCategory = parentCategory;
        
        const existingCategory = await Category.findOne(query);
        if (existingCategory) {
            return res.status(409).json({
                success: false,
                message: "Category with this name already exists."
            });
        }

        const category = await Category.create({
            name: name.trim(),
            slug,
            description: description || "",
            image: imageUrl,
            type,
            subType: subType || null,
            parentCategory: parentCategory || null,
            order: order || 0,
            isActive: isActive !== undefined ? isActive === 'true' || isActive === true : true,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully.",
            data: category
        });
    } catch (error) {
        console.error("Create Category Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Categories
 */
export const getAllCategories = async (req, res) => {
    try {
        const { type, subType, parentCategory, isActive } = req.query;

        const query = {};
        if (type) query.type = type;
        if (subType) query.subType = subType;
        if (parentCategory) query.parentCategory = parentCategory;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const categories = await Category.find(query)
            .populate("createdBy", "name email")
            .populate("parentCategory", "name slug")
            .sort({ order: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Categories retrieved successfully.",
            data: categories
        });
    } catch (error) {
        console.error("Get All Categories Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Category
 */
export const getCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        const category = await Category.findById(categoryId)
            .populate("createdBy", "name email");

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category retrieved successfully.",
            data: category
        });
    } catch (error) {
        console.error("Get Category Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Category
 */
export const updateCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update categories."
            });
        }

        const { categoryId } = req.params;
        const { name, description, image, subType, parentCategory, isActive, order } = req.body;

        // Handle image upload if new file is provided
        let imageUrl = image;
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
        } else if (image !== undefined) {
            // If image is explicitly set (even if null), use it
            imageUrl = image;
        }

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        // Update fields
        if (name !== undefined && name !== null) {
            category.name = name.trim();
            category.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        if (description !== undefined) category.description = description;
        if (imageUrl !== undefined) category.image = imageUrl;
        if (isActive !== undefined) {
            category.isActive = isActive === 'true' || isActive === true;
        }
        if (subType !== undefined) {
            if (category.type === 'car' && subType && !['make', 'model', 'year'].includes(subType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subType for car category."
                });
            }
            if (category.type === 'location' && subType && !['country', 'city', 'state'].includes(subType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subType for location category."
                });
            }
            category.subType = subType;
        }
        if (parentCategory !== undefined) {
            if (parentCategory && !mongoose.Types.ObjectId.isValid(parentCategory)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid parent category ID."
                });
            }

            if (parentCategory) {
                const parent = await Category.findById(parentCategory);
                if (!parent) {
                    return res.status(404).json({
                        success: false,
                        message: "Parent category not found."
                    });
                }
                if (category.type === 'car' && category.subType === 'model' && parent.subType !== 'make') {
                    return res.status(400).json({
                        success: false,
                        message: "Model categories must have a make category as parent."
                    });
                }
                if (category.type === 'location' && ['city', 'state'].includes(category.subType) && parent.subType !== 'country') {
                    return res.status(400).json({
                        success: false,
                        message: "City and state categories must have a country category as parent."
                    });
                }
            }

            category.parentCategory = parentCategory || null;
        }
        if (isActive !== undefined) category.isActive = isActive;
        if (order !== undefined) category.order = order;

        await category.save();

        return res.status(200).json({
            success: true,
            message: "Category updated successfully.",
            data: category
        });
    } catch (error) {
        console.error("Update Category Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Category
 */
export const deleteCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete categories."
            });
        }

        const { categoryId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        await category.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully."
        });
    } catch (error) {
        console.error("Delete Category Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

