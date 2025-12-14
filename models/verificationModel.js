import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    documentType: {
        type: String,
        enum: ['national_id', 'passport', 'driving_license', 'business_license'],
        required: true
    },
    frontDocument: {
        type: String, // Cloudinary URL
        required: true
    },
    backDocument: {
        type: String, // Cloudinary URL (if applicable)
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    rejectionReason: {
        type: String,
        default: null
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for faster queries
verificationSchema.index({ user: 1 });
verificationSchema.index({ status: 1 });
verificationSchema.index({ submittedAt: -1 });

const Verification = mongoose.model('Verification', verificationSchema);

export default Verification;
