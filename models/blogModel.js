import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    content: {
        type: String,
        required: true
    },
    excerpt: {
        type: String,
        default: ""
    },
    featuredImage: {
        type: String,
        default: null
    },
    images: [{
        type: String
    }],
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: false,
        default: null
    },
    tags: [{
        type: String,
        trim: true
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["draft", "published", "archived", "scheduled", "pending"],
        default: "draft"
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    views: {
        type: Number,
        default: 0
    },
    readTime: {
        type: Number, // in minutes
        default: 5
    },
    metaTitle: {
        type: String,
        default: ""
    },
    metaDescription: {
        type: String,
        default: ""
    },
    publishedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ isFeatured: 1, publishedAt: -1 });

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;

