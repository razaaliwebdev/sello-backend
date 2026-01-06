import mongoose from "mongoose";

const blogViewSchema = new mongoose.Schema(
  {
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
    ip: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
    // Optional: user if logged in
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    // We can use createdAt for the timestamp
  },
  {
    timestamps: true,
  }
);

blogViewSchema.index({ blog: 1, createdAt: -1 });

const BlogView = mongoose.model("BlogView", blogViewSchema);

export default BlogView;
