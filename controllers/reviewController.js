import Review from "../models/reviewModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";

// Add a Review
export const addReview = async (req, res) => {
    try {
        const { targetUserId, rating, comment, carId } = req.body;
        const reviewerId = req.user._id;

        if (reviewerId.toString() === targetUserId) {
            return res.status(400).json({ message: "You cannot review yourself." });
        }

        const existingReview = await Review.findOne({
            reviewer: reviewerId,
            targetUser: targetUserId,
            transaction: carId || null
        });

        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this user for this transaction." });
        }

        const review = await Review.create({
            reviewer: reviewerId,
            targetUser: targetUserId,
            rating,
            comment,
            transaction: carId || null
        });

        // Update User's Average Rating
        const stats = await Review.aggregate([
            { $match: { targetUser: new mongoose.Types.ObjectId(targetUserId) } },
            {
                $group: {
                    _id: "$targetUser",
                    avgRating: { $avg: "$rating" },
                    count: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            await User.findByIdAndUpdate(targetUserId, {
                sellerRating: stats[0].avgRating,
                reviewCount: stats[0].count
            });
        }

        return res.status(201).json({
            success: true,
            message: "Review added successfully",
            data: review
        });

    } catch (error) {
        console.error("Add Review Error:", error);
        return res.status(500).json({ message: "Server error adding review" });
    }
};

// Get Reviews for a User
export const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        // Only show approved reviews for non-admins
        const filter = { targetUser: userId };
        if (req.user?.role !== 'admin') {
            filter.isApproved = true;
        }
        
        const reviews = await Review.find(filter)
            .populate("reviewer", "name avatar")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: reviews
        });
    } catch (error) {
        console.error("Get Reviews Error:", error);
        return res.status(500).json({ message: "Server error fetching reviews" });
    }
};

/**
 * Moderate Review (Admin)
 */
export const moderateReview = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can moderate reviews."
            });
        }

        const { reviewId } = req.params;
        const { isApproved, moderationReason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid review ID."
            });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        review.isApproved = isApproved === true || isApproved === 'true';
        review.moderatedBy = req.user._id;
        review.moderatedAt = new Date();
        review.moderationReason = moderationReason || null;

        await review.save();

        // If rejected, recalculate user rating
        if (!review.isApproved) {
            const stats = await Review.aggregate([
                { $match: { targetUser: review.targetUser, isApproved: true } },
                {
                    $group: {
                        _id: "$targetUser",
                        avgRating: { $avg: "$rating" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            if (stats.length > 0) {
                await User.findByIdAndUpdate(review.targetUser, {
                    sellerRating: stats[0].avgRating,
                    reviewCount: stats[0].count
                });
            } else {
                // No approved reviews left
                await User.findByIdAndUpdate(review.targetUser, {
                    sellerRating: 0,
                    reviewCount: 0
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Review ${review.isApproved ? 'approved' : 'rejected'} successfully.`,
            data: review
        });
    } catch (error) {
        console.error("Moderate Review Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error moderating review."
        });
    }
};

/**
 * Report Review
 */
export const reportReview = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { reviewId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid review ID."
            });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        // Check if already reported by this user
        if (review.reportedBy && review.reportedBy.includes(req.user._id)) {
            return res.status(200).json({
                success: true,
                message: "You have already reported this review."
            });
        }

        if (!review.reportedBy) {
            review.reportedBy = [];
        }
        review.reportedBy.push(req.user._id);
        review.isReported = true;
        await review.save();

        return res.status(200).json({
            success: true,
            message: "Review reported successfully. Admin will review it."
        });
    } catch (error) {
        console.error("Report Review Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error reporting review."
        });
    }
};

/**
 * Get All Reviews (Admin)
 */
export const getAllReviews = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view all reviews."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { isApproved, isReported, search } = req.query;

        const filter = {};
        if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
        if (isReported !== undefined) filter.isReported = isReported === 'true';

        if (search) {
            filter.$or = [
                { comment: { $regex: search, $options: 'i' } }
            ];
        }

        const reviews = await Review.find(filter)
            .populate("reviewer", "name email avatar")
            .populate("targetUser", "name email avatar")
            .populate("transaction", "title make model")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Review.countDocuments(filter);

        return res.status(200).json({
            success: true,
            message: "Reviews retrieved successfully.",
            data: {
                reviews,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get All Reviews Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching reviews."
        });
    }
};
