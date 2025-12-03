import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["info", "success", "warning", "error", "system"],
        default: "info"
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null // null means broadcast to all users or role-based
    },
    targetRole: {
        type: String,
        enum: ["buyer", "seller", "dealer", null],
        default: null // null means all users, or specific role for targeting
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    actionUrl: {
        type: String,
        default: null
    },
    actionText: {
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

