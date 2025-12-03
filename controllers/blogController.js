import Blog from '../models/blogModel.js';
import Category from '../models/categoryModel.js';
import mongoose from 'mongoose';
import { uploadCloudinary } from '../utils/cloudinary.js';

/**
 * Generate slug from title
 */
const generateSlug = (title) => {
    return title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

/**
 * Calculate read time
 */
const calculateReadTime = (content) => {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
};

/**
 * Create Blog Post
 */
export const createBlog = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can create blog posts."
            });
        }

        const { title, content, excerpt, category, tags, status, metaTitle, metaDescription } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required."
            });
        }

        // Validate category if provided
        if (category) {
            if (!mongoose.Types.ObjectId.isValid(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category ID."
                });
            }

            // Check if category exists
            const categoryExists = await Category.findById(category);
            if (!categoryExists || categoryExists.type !== 'blog') {
                return res.status(400).json({
                    success: false,
                    message: "Invalid blog category."
                });
            }
        }

        const slug = generateSlug(title);
        
        // Check if slug already exists
        const existingBlog = await Blog.findOne({ slug });
        if (existingBlog) {
            return res.status(409).json({
                success: false,
                message: "Blog post with this title already exists."
            });
        }

        // Handle featured image
        let featuredImage = null;
        if (req.files && req.files.featuredImage && req.files.featuredImage[0]) {
            featuredImage = await uploadCloudinary(req.files.featuredImage[0].buffer);
        }

        // Handle multiple images
        let images = [];
        if (req.files && req.files.images && req.files.images.length > 0) {
            images = await Promise.all(
                req.files.images.map(async (file) => {
                    try {
                        return await uploadCloudinary(file.buffer);
                    } catch (err) {
                        console.error("Error uploading image:", err);
                        return null;
                    }
                })
            );
            images = images.filter(url => url);
        }

        const readTime = calculateReadTime(content);

        const blog = await Blog.create({
            title: title.trim(),
            slug,
            content,
            excerpt: excerpt || content.substring(0, 200) + "...",
            featuredImage,
            images,
            category: category || null,
            tags: tags ? (typeof tags === 'string' && tags.startsWith('[') ? JSON.parse(tags) : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : (Array.isArray(tags) ? tags : []))) : [],
            author: req.user._id,
            status: status || "draft",
            readTime,
            metaTitle: metaTitle || title,
            metaDescription: metaDescription || excerpt || content.substring(0, 160),
            publishedAt: status === 'published' ? new Date() : null
        });

        return res.status(201).json({
            success: true,
            message: "Blog post created successfully.",
            data: blog
        });
    } catch (error) {
        console.error("Create Blog Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Blog Posts
 */
export const getAllBlogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { status, category, author, search, isFeatured } = req.query;

        const query = {};
        
        // If user is not admin, only show published blogs
        if (!req.user || req.user.role !== 'admin') {
            query.status = 'published';
        } else if (status) {
            // Admin can filter by any status
            query.status = status;
        }
        
        if (category) query.category = category;
        if (author) query.author = author;
        if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } }
            ];
        }

        const blogs = await Blog.find(query)
            .populate("category", "name slug")
            .populate("author", "name email avatar")
            .skip(skip)
            .limit(limit)
            .sort({ publishedAt: -1, createdAt: -1 });

        const total = await Blog.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Blog posts retrieved successfully.",
            data: {
                blogs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Blogs Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Blog Post
 */
export const getBlogById = async (req, res) => {
    try {
        const { blogId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(blogId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid blog ID."
            });
        }

        const blog = await Blog.findById(blogId)
            .populate("category", "name slug")
            .populate("author", "name email avatar");

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog post not found."
            });
        }

        // If user is not admin, only allow access to published blogs
        if ((!req.user || req.user.role !== 'admin') && blog.status !== 'published') {
            return res.status(404).json({
                success: false,
                message: "Blog post not found."
            });
        }

        // Increment views
        blog.views += 1;
        await blog.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: "Blog post retrieved successfully.",
            data: blog
        });
    } catch (error) {
        console.error("Get Blog Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Blog Post
 */
export const updateBlog = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update blog posts."
            });
        }

        const { blogId } = req.params;
        const { title, content, excerpt, category, tags, status, isFeatured, metaTitle, metaDescription } = req.body;

        if (!mongoose.Types.ObjectId.isValid(blogId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid blog ID."
            });
        }

        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog post not found."
            });
        }

        // Update fields
        if (title) {
            blog.title = title.trim();
            blog.slug = generateSlug(title);
        }
        if (content) {
            blog.content = content;
            blog.readTime = calculateReadTime(content);
        }
        if (excerpt !== undefined) blog.excerpt = excerpt;
        if (category) {
            if (!mongoose.Types.ObjectId.isValid(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category ID."
                });
            }
            blog.category = category;
        }
        if (tags !== undefined) {
            blog.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        }
        if (status) {
            blog.status = status;
            if (status === 'published' && !blog.publishedAt) {
                blog.publishedAt = new Date();
            }
        }
        if (isFeatured !== undefined) blog.isFeatured = isFeatured;
        if (metaTitle) blog.metaTitle = metaTitle;
        if (metaDescription) blog.metaDescription = metaDescription;

        // Handle featured image update
        if (req.files && req.files.featuredImage && req.files.featuredImage[0]) {
            blog.featuredImage = await uploadCloudinary(req.files.featuredImage[0].buffer);
        }

        // Handle additional images
        if (req.files && req.files.images && req.files.images.length > 0) {
            const newImages = await Promise.all(
                req.files.images.map(async (file) => {
                    try {
                        return await uploadCloudinary(file.buffer);
                    } catch (err) {
                        console.error("Error uploading image:", err);
                        return null;
                    }
                })
            );
            blog.images = [...(blog.images || []), ...newImages.filter(url => url)];
        }

        await blog.save();

        return res.status(200).json({
            success: true,
            message: "Blog post updated successfully.",
            data: blog
        });
    } catch (error) {
        console.error("Update Blog Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Blog Post
 */
export const deleteBlog = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete blog posts."
            });
        }

        const { blogId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(blogId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid blog ID."
            });
        }

        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog post not found."
            });
        }

        await blog.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Blog post deleted successfully."
        });
    } catch (error) {
        console.error("Delete Blog Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

