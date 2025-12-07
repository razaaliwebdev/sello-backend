import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporter: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true,
        index: true
    },
    targetType: { 
        type: String, 
        enum: ["Car", "User", "Review", "Chat"], 
        required: true,
        index: true
    },
    targetId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        index: true
    },
    reason: { 
        type: String, 
        required: true,
        enum: [
            "Spam",
            "Inappropriate Content",
            "Misleading Information",
            "Fake Listing",
            "Harassment",
            "Other"
        ]
    },
    description: { 
        type: String,
        maxlength: 1000
    },
    status: { 
        type: String, 
        enum: ["pending", "reviewing", "resolved", "dismissed"], 
        default: "pending",
        index: true
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    adminNotes: {
        type: String,
        default: null
    }
}, { 
    timestamps: true 
});

// Compound index for preventing duplicate reports
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

// Index for admin queries
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;

