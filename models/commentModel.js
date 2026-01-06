import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "spam"],
      default: "pending",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ blog: 1, status: 1 });
commentSchema.index({ user: 1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
