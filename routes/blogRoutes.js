import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  getBlogAnalytics,
} from "../controllers/blogController.js";
import { upload } from "../middlewares/multer.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import { hasPermission } from "../middlewares/permissionMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllBlogs);
router.get("/:blogId", getBlogById);

// Admin routes with permission checks
router.use(auth);
router.use(authorize("admin"));

router.post(
  "/",
  hasPermission("createBlogs"),
  upload.fields([
    { name: "featuredImage", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  createBlog
);
router.put(
  "/:blogId",
  hasPermission("editBlogs"),
  upload.fields([
    { name: "featuredImage", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  updateBlog
);
router.delete("/:blogId", hasPermission("deleteBlogs"), deleteBlog);

// Analytics
router.get("/:blogId/analytics", hasPermission("editBlogs"), getBlogAnalytics);

// --- Comment Routes ---

import {
  createComment,
  getBlogComments,
  getAllComments,
  updateCommentStatus,
  deleteComment,
} from "../controllers/commentController.js";

// Public Comment Routes
router.get("/:blogId/comments", getBlogComments);

// Protected Comment Routes (User)
router.post("/:blogId/comments", auth, createComment); // User creates comment
router.delete("/comments/:commentId", auth, deleteComment); // User deletes own comment (or admin)

// Admin Comment Routes
router.get("/comments/all", auth, authorize("admin"), getAllComments); // Admin lists all
router.put("/comments/:commentId/status", auth, authorize("admin"), updateCommentStatus); // Admin review
router.delete("/comments/:commentId/admin", auth, authorize("admin"), deleteComment); // Admin delete

export default router;
