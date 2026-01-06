import Comment from "../models/commentModel.js";
import Blog from "../models/blogModel.js";
import mongoose from "mongoose";

/**
 * Create a new comment
 */
export const createComment = async (req, res) => {
  try {
    const { content, blogId } = req.body;
    const userId = req.user._id;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required.",
      });
    }

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

    // Auto-approve comments for admins, otherwise pending
    const status = req.user.role === "admin" ? "approved" : "pending";

    const comment = await Comment.create({
      content: content.trim(),
      blog: blogId,
      user: userId,
      status,
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      "user",
      "name avatar role"
    );

    return res.status(201).json({
      success: true,
      message:
        status === "pending"
          ? "Comment submitted for review."
          : "Comment posted successfully.",
      data: populatedComment,
    });
  } catch (error) {
    console.error("Create Comment Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get comments for a blog (Public - Approved only)
 */
export const getBlogComments = async (req, res) => {
  try {
    const { blogId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID.",
      });
    }

    const query = { blog: blogId, status: "approved" };

    const comments = await Comment.find(query)
      .populate("user", "name avatar role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get Blog Comments Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get all comments (Admin - All statuses)
 */
export const getAllComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, search, blogId } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (blogId) {
        query.blog = blogId;
    }

    if (search) {
      query.content = { $regex: search, $options: "i" };
    }

    const comments = await Comment.find(query)
      .populate("user", "name email avatar")
      .populate("blog", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get All Comments Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update comment status (Admin)
 */
export const updateCommentStatus = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "spam", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { status },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Comment marked as ${status}.`,
      data: comment,
    });
  } catch (error) {
    console.error("Update Comment Status Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete comment (Admin or Owner)
 */
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    // Check permission: Admin or Comment Owner
    if (
      req.user.role !== "admin" &&
      comment.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment.",
      });
    }

    await comment.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Comment Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
