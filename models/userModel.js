import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot exceed 50 characters']
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
        },
        password: {
            type: String,
            required: true,
            minlength: [6, 'Password must be at least 6 characters']
        },
        otp: {
            type: String,
            default: null
        },
        otpExpiry: {
            type: Date,
            default: null
        },
        verified: {
            type: Boolean,
            default: false
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ["active", "inactive", "suspended"],
            default: "active"
        },
        role: {
            type: String,
            enum: ["buyer", "seller", "admin", "dealer"],
            default: "buyer"
        },
        avatar: {
            type: String,
            default: null
        },
        lastLogin: {
            type: Date,
            default: null
        },
        // Boost & Subscription Fields
        boostCredits: {
            type: Number,
            default: 0,
            min: 0
        },
        subscription: {
            plan: {
                type: String,
                enum: ["free", "basic", "premium", "dealer"],
                default: "free"
            },
            startDate: {
                type: Date,
                default: null
            },
            endDate: {
                type: Date,
                default: null
            },
            isActive: {
                type: Boolean,
                default: false
            },
            autoRenew: {
                type: Boolean,
                default: false
            }
        },
        paymentHistory: [{
            amount: { type: Number, required: true },
            currency: { type: String, default: "USD" },
            paymentMethod: { type: String },
            transactionId: { type: String },
            purpose: { type: String, enum: ["boost", "subscription", "credits"], required: true },
            status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
            createdAt: { type: Date, default: Date.now }
        }],
        totalSpent: {
            type: Number,
            default: 0,
            min: 0
        },
        // Dealer Specific Fields
        dealerInfo: {
            businessName: { type: String, default: null },
            businessLicense: { type: String, default: null },
            businessAddress: { type: String, default: null },
            businessPhone: { type: String, default: null },
            verified: { type: Boolean, default: false },
            verifiedAt: { type: Date, default: null }
        },
        // 🚗 Cars posted by user (as seller)
        carsPosted: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Car"
            }
        ],
        // 🚗 Cars bought by user (as buyer)
        carsPurchased: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Car"
            }
        ]
    },
    {
        timestamps: true
    }
);

// Indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ "subscription.isActive": 1, "subscription.plan": 1 });

const User = mongoose.model("User", userSchema);

export default User;
