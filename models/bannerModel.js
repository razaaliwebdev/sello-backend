import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        required: true
    },
    linkUrl: {
        type: String,
        default: null
    },
    type: {
        type: String,
        enum: ["homepage", "promotional"],
        required: true,
        default: "homepage"
    },
    position: {
        type: String,
        enum: ["hero", "sidebar", "footer", "top", "bottom"],
        default: "hero"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },
    clicks: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});

bannerSchema.index({ type: 1, isActive: 1, order: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;

