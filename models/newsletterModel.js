import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    status: {
        type: String,
        enum: ['subscribed', 'unsubscribed', 'pending'],
        default: 'subscribed'
    },
    subscribedAt: {
        type: Date,
        default: Date.now
    },
    unsubscribedAt: {
        type: Date,
        default: null
    },
    source: {
        type: String,
        default: 'website' // website, admin, api
    }
}, {
    timestamps: true
});

// Index for faster queries
// Note: email already has an index from unique: true
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ subscribedAt: -1 });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

export default Newsletter;

