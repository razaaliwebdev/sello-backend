import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        expiresAt: {
            type: Date,
            required: true
            // Note: TTL index defined below, don't use index: true here
        },
        userAgent: {
            type: String,
            default: null
        },
        ipAddress: {
            type: String,
            default: null
        },
        isRevoked: {
            type: Boolean,
            default: false,
            index: true
        },
        revokedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Compound indexes for faster lookups
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ token: 1, isRevoked: 1 });
// TTL index for auto-deleting expired tokens (replaces the index: true on expiresAt field)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if token is valid
refreshTokenSchema.methods.isValid = function() {
    return !this.isRevoked && this.expiresAt > new Date();
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;

