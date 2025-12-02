import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: null
    },
    type: {
        type: String,
        enum: ["car", "blog", "location"],
        required: true
    },
    subType: {
        type: String,
        enum: ["make", "model", "year", "country", "city", "state", null],
        default: null
    },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true
});

categorySchema.index({ type: 1, isActive: 1 });
categorySchema.index({ type: 1, subType: 1, isActive: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ parentCategory: 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;

