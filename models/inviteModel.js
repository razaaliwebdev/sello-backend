import mongoose from 'mongoose';
import crypto from 'crypto';

const inviteSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            default: null,
            trim: true
        },
        role: {
            type: String,
            required: true,
            enum: ["Super Admin", "Marketing Team", "Support Agent", "Blogs/Content Agent", "Custom"]
        },
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role",
            default: null
        },
        permissions: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        token: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        expiresAt: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "expired", "cancelled"],
            default: "pending"
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        acceptedAt: {
            type: Date,
            default: null
        },
        acceptedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Generate unique token
inviteSchema.statics.generateToken = function () {
    return crypto.randomBytes(32).toString('hex');
};

// Check if invite is expired
inviteSchema.methods.isExpired = function () {
    return this.expiresAt < new Date();
};

const Invite = mongoose.model("Invite", inviteSchema);

export default Invite;

