/**
 * Recently Viewed Listings Model
 * Tracks user's recently viewed cars for recommendations
 */

import mongoose from 'mongoose';

const recentlyViewedSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
      // Note: Indexes defined below to avoid duplicates
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true
      // Note: Indexes defined below to avoid duplicates
    },
    viewedAt: {
      type: Date,
      default: Date.now
      // Note: TTL index defined below, don't use index: true here
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
// Note: Using compound indexes only - Mongoose will use these for single-field queries too
recentlyViewedSchema.index({ user: 1, viewedAt: -1 });
recentlyViewedSchema.index({ car: 1, viewedAt: -1 });

// Prevent duplicate entries (same user viewing same car multiple times)
// Instead, update the viewedAt timestamp
recentlyViewedSchema.index({ user: 1, car: 1 }, { unique: true });

// TTL index – automatically delete entries after 30 days
// This mimics real-world apps where "recently viewed" data expires.
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
recentlyViewedSchema.index(
  { viewedAt: 1 },
  { expireAfterSeconds: THIRTY_DAYS_IN_SECONDS }
);

const RecentlyViewed = mongoose.model("RecentlyViewed", recentlyViewedSchema);

export default RecentlyViewed;

