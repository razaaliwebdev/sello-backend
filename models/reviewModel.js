import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        transaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Car", // Optional: link to a specific car transaction
            default: null,
        },
        // Moderation fields
        isApproved: {
            type: Boolean,
            default: true, // Auto-approve, admin can reject
            index: true
        },
        isReported: {
            type: Boolean,
            default: false,
            index: true
        },
        reportedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        moderationReason: {
            type: String,
            default: null
        },
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        moderatedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
    }
);

// Prevent duplicate reviews for the same transaction (if linked)
reviewSchema.index({ reviewer: 1, targetUser: 1, transaction: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
