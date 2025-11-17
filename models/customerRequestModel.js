import mongoose from 'mongoose';

const customerRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ['support', 'inquiry', 'complaint', 'feature_request', 'bug_report', 'other'],
        default: 'support',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    attachments: [{
        type: String
    }],
    responses: [{
        responder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        message: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    tags: [{
        type: String
    }]
}, {
    timestamps: true
});

customerRequestSchema.index({ user: 1 });
customerRequestSchema.index({ status: 1 });
customerRequestSchema.index({ priority: 1 });
customerRequestSchema.index({ assignedTo: 1 });
customerRequestSchema.index({ type: 1 });
customerRequestSchema.index({ createdAt: -1 });

const CustomerRequest = mongoose.model("CustomerRequest", customerRequestSchema);

export default CustomerRequest;

