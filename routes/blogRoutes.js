import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
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

export default router;
