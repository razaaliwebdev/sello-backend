import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        actorEmail: {
            type: String,
            required: true
        },
        action: {
            type: String,
            required: true,
            enum: [
                "role_created",
                "role_updated",
                "role_deleted",
                "user_invited",
                "user_role_changed",
                "user_approved",
                "user_rejected",
                "password_reset",
                "listing_approved",
                "listing_rejected",
                "dealer_approved",
                "dealer_rejected",
                "permission_changed",
                "settings_changed",
                "financial_access",
                "sensitive_action"
            ]
        },
        target: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        targetEmail: {
            type: String,
            default: null
        },
        details: {
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
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Indexes for efficient querying
auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ target: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

