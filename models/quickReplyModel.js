import mongoose from 'mongoose';

const quickReplySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['greeting', 'support', 'pricing', 'general', 'other'],
        default: 'general'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    usageCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

quickReplySchema.index({ title: 1 });
quickReplySchema.index({ category: 1 });
quickReplySchema.index({ isActive: 1 });

const QuickReply = mongoose.model("QuickReply", quickReplySchema);

export default QuickReply;

