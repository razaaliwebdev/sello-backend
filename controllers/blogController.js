import Blog from "../models/blogModel.js";
import Category from "../models/categoryModel.js";
import BlogView from "../models/blogViewModel.js";
import mongoose from "mongoose";
import { uploadCloudinary } from "../utils/cloudinary.js";

/**
 * Generate slug from title
 */
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create blog posts.",
      });
    }

    const {
      title,
      content,
      excerpt,
      category,
      tags,
      status,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required.",
      });
    }

    // Validate category if provided
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID.",
        });
      }

      // Check if category exists
      const categoryExists = await Category.findById(category);
      if (!categoryExists || categoryExists.type !== "blog") {
        return res.status(400).json({
          success: false,
          message: "Invalid blog category.",
        });
      }
    }

    const slug = generateSlug(title);

    // Check if slug already exists
    const existingBlog = await Blog.findOne({ slug });
    if (existingBlog) {
      return res.status(409).json({
        success: false,
        message: "Blog post with this title already exists.",
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
      images = images.filter((url) => url);
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
      tags: tags
        ? typeof tags === "string" && tags.startsWith("[")
          ? JSON.parse(tags)
          : typeof tags === "string"
          ? tags.split(",").map((t) => t.trim())
          : Array.isArray(tags)
          ? tags
          : []
        : [],
      author: req.user._id,
      status: status || "draft",
      readTime,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt || content.substring(0, 160),
      metaKeywords: metaKeywords || "",
      publishedAt: req.body.publishedAt
        ? new Date(req.body.publishedAt)
        : status === "published"
        ? new Date()
        : null,
    });

    return res.status(201).json({
      success: true,
      message: "Blog post created successfully.",
      data: blog,
    });
  } catch (error) {
    console.error("Create Blog Error:", error.message);

    // Handle specific timeout errors
    if (error.message && error.message.includes("timeout")) {
      return res.status(408).json({
        success: false,
        message:
          "Blog creation timed out. This may be due to large image uploads. Please try with smaller images or fewer images.",
        code: "BLOG_CREATION_TIMEOUT",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
    const { status, category, author, search, isFeatured, exclude } = req.query;

    const query = {};

    // If user is not admin, only show published blogs
    if (!req.user || req.user.role !== "admin") {
      query.status = "published";
    } else if (status) {
      // Admin can filter by any status
      query.status = status;
    }

    if (category) query.category = category;
    if (author) query.author = author;
    if (isFeatured !== undefined) query.isFeatured = isFeatured === "true";

    // Exclude specific blog ID (for related blogs)
    if (exclude) {
      if (mongoose.Types.ObjectId.isValid(exclude)) {
        query._id = { $ne: new mongoose.Types.ObjectId(exclude) };
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
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
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get All Blogs Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Single Blog Post (by ID or slug)
 */
export const getBlogById = async (req, res) => {
  try {
    const { blogId } = req.params;

    // Check if blogId is a valid ObjectId or a slug
    const isObjectId = mongoose.Types.ObjectId.isValid(blogId);

    let blog;
    if (isObjectId) {
      // Find by ID
      blog = await Blog.findById(blogId)
        .populate("category", "name slug")
        .populate("author", "name email avatar");
    } else {
      // Find by slug
      blog = await Blog.findOne({ slug: blogId })
        .populate("category", "name slug")
        .populate("author", "name email avatar");
    }

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found.",
      });
    }

    // If user is not admin, only allow access to published blogs
    if (
      (!req.user || req.user.role !== "admin") &&
      blog.status !== "published"
    ) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found.",
      });
    }

    // Increment views (only for published blogs viewed by non-admins)
    if (
      (!req.user || req.user.role !== "admin") &&
      blog.status === "published"
    ) {
      // Fire and forget view tracking
      blog.views += 1;
      blog
        .save({ validateBeforeSave: false })
        .catch((err) => console.error("Error saving blog view count:", err));

      BlogView.create({
        blog: blog._id,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        user: req.user?._id,
      }).catch((err) => console.error("Error creating blog view record:", err));
    }

    return res.status(200).json({
      success: true,
      message: "Blog post retrieved successfully.",
      data: blog,
    });
  } catch (error) {
    console.error("Get Blog Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update Blog Post
 */
export const updateBlog = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update blog posts.",
      });
    }

    const { blogId } = req.params;
    const {
      title,
      content,
      excerpt,
      category,
      tags,
      status,
      isFeatured,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID.",
      });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found.",
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
          message: "Invalid category ID.",
        });
      }
      blog.category = category;
    }
    if (tags !== undefined) {
      blog.tags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim());
    }

    // Handle status and publishedAt
    if (status) {
      blog.status = status;
    }

    // Allow updating publishedAt manually (e.g. for scheduling or backdating)
    if (req.body.publishedAt) {
      blog.publishedAt = new Date(req.body.publishedAt);
    } else if (status === "published" && !blog.publishedAt) {
      // If publishing now and no date set, set to now
      blog.publishedAt = new Date();
    }

    if (isFeatured !== undefined) blog.isFeatured = isFeatured;
    if (metaTitle) blog.metaTitle = metaTitle;
    if (metaDescription) blog.metaDescription = metaDescription;
    if (metaKeywords) blog.metaKeywords = metaKeywords;

    // Handle featured image update
    if (req.files && req.files.featuredImage && req.files.featuredImage[0]) {
      blog.featuredImage = await uploadCloudinary(
        req.files.featuredImage[0].buffer
      );
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
      blog.images = [...(blog.images || []), ...newImages.filter((url) => url)];
    }

    await blog.save();

    return res.status(200).json({
      success: true,
      message: "Blog post updated successfully.",
      data: blog,
    });
  } catch (error) {
    console.error("Update Blog Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete Blog Post
 */
export const deleteBlog = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete blog posts.",
      });
    }

    const { blogId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID.",
      });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found.",
      });
    }

    await blog.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Blog post deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Blog Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Blog Analytics (Views over time)
 */
export const getBlogAnalytics = async (req, res) => {
  try {
    const { blogId } = req.params;
    const days = parseInt(req.query.days) || 30; // Default 30 days

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID.",
      });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const views = await BlogView.aggregate([
      {
        $match: {
          blog: new mongoose.Types.ObjectId(blogId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing dates with 0 views
    const analytics = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split("T")[0];
      const found = views.find((v) => v._id === dateStr);
      analytics.push({
        date: dateStr,
        views: found ? found.count : 0,
      });
    }

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Get Blog Analytics Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};
