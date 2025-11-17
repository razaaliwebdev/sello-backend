import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    type: {
        type: String,
        enum: ["string", "number", "boolean", "object", "array"],
        default: "string"
    },
    category: {
        type: String,
        enum: ["general", "payment", "boost", "email", "seo", "social", "other"],
        default: "general"
    },
    description: {
        type: String,
        default: ""
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true
});

settingsSchema.index({ key: 1 });
settingsSchema.index({ category: 1 });

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;

