/**
 * Analytics Model
 * Stores analytics events for reporting
 */

import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
    event: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
analyticsSchema.index({ event: 1, createdAt: -1 });
analyticsSchema.index({ userId: 1, createdAt: -1 });
analyticsSchema.index({ createdAt: -1 });

const Analytics = mongoose.model("Analytics", analyticsSchema);

export default Analytics;

