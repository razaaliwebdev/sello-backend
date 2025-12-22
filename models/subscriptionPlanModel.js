import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // unique: true automatically creates an index, don't need schema.index()
        trim: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    duration: {
        type: Number,
        required: true,
        min: 1, // days
        default: 30
    },
    features: [{
        type: String,
        trim: true
    }],
    maxListings: {
        type: Number,
        default: -1, // -1 means unlimited
        required: true
    },
    boostCredits: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ""
    },
    // Visibility and Access Control
    visible: {
        type: Boolean,
        default: true
    },
    allowedRoles: [{
        type: String,
        enum: ["user", "dealer", "admin", "all"],
        default: "all"
    }],
    minUserLevel: {
        type: Number,
        default: 0 // 0 = all users, higher = requires certain level
    },
    requiresApproval: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true
});

// Indexes
subscriptionPlanSchema.index({ isActive: 1, order: 1 });
// Note: name already has an index from unique: true, no need for duplicate index

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

export default SubscriptionPlan;
