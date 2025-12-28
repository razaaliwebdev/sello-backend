import mongoose from "mongoose";

const accountDeletionRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "no_longer_needed",
        "privacy_concerns",
        "found_alternative",
        "poor_experience",
        "data_concerns",
        "account_security",
        "other",
      ],
    },
    additionalComments: {
      type: String,
      maxlength: [500, "Comments cannot exceed 500 characters"],
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      maxlength: [500, "Review notes cannot exceed 500 characters"],
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
accountDeletionRequestSchema.index({ user: 1 });
accountDeletionRequestSchema.index({ status: 1 });
accountDeletionRequestSchema.index({ createdAt: -1 });
accountDeletionRequestSchema.index({ status: 1, createdAt: -1 }); // Compound index for admin queries

const AccountDeletionRequest = mongoose.model(
  "AccountDeletionRequest",
  accountDeletionRequestSchema
);

export default AccountDeletionRequest;
