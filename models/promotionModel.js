import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    promoCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true,
        default: "percentage"
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    usageLimit: {
        type: Number,
        required: true,
        min: 1,
        default: 1000
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    targetAudience: {
        type: String,
        enum: ["all", "buyers", "sellers", "dealers"],
        default: "all"
    },
    status: {
        type: String,
        enum: ["active", "inactive", "expired"],
        default: "active"
    },
    minPurchaseAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
promotionSchema.index({ promoCode: 1, status: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });
promotionSchema.index({ status: 1, isActive: 1 });

// Virtual to check if promotion is currently valid
promotionSchema.virtual('isValid').get(function () {
    const now = new Date();
    return (
        this.status === 'active' &&
        this.isActive &&
        this.usedCount < this.usageLimit &&
        this.startDate <= now &&
        this.endDate >= now
    );
});

// Method to check if promotion can be used
promotionSchema.methods.canBeUsed = function () {
    const now = new Date();
    return (
        this.status === 'active' &&
        this.isActive &&
        this.usedCount < this.usageLimit &&
        this.startDate <= now &&
        this.endDate >= now
    );
};

// Method to calculate discount
promotionSchema.methods.calculateDiscount = function (amount) {
    if (!this.canBeUsed()) {
        return 0;
    }

    let discount = 0;

    if (this.discountType === 'percentage') {
        discount = (amount * this.discountValue) / 100;
        if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
            discount = this.maxDiscountAmount;
        }
    } else {
        discount = this.discountValue;
    }

    return Math.min(discount, amount); // Discount can't exceed the amount
};

// Pre-save middleware to update status based on dates
promotionSchema.pre('save', function (next) {
    const now = new Date();

    if (this.endDate < now && this.status !== 'expired') {
        this.status = 'expired';
    }

    next();
});

const Promotion = mongoose.model("Promotion", promotionSchema);

export default Promotion;

