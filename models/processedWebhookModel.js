import mongoose from 'mongoose';

/**
 * Processed Webhook Model
 * Tracks processed Stripe webhook events to prevent duplicate processing
 */
const processedWebhookSchema = new mongoose.Schema(
    {
        eventId: {
            type: String,
            required: true
            // Unique index created below
        },
        eventType: {
            type: String,
            required: true
        },
        processedAt: {
            type: Date,
            default: Date.now
            // Index created below with TTL
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

// Index for cleanup queries (expired events older than 30 days)
processedWebhookSchema.index({ processedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

// Prevent duplicate event processing
processedWebhookSchema.index({ eventId: 1 }, { unique: true });

const ProcessedWebhook = mongoose.model('ProcessedWebhook', processedWebhookSchema);

export default ProcessedWebhook;

