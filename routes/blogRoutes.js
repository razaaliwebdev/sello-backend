import express from 'express';
import {
    createBlog,
    getAllBlogs,
    getBlogById,
    updateBlog,
    deleteBlog
} from '../controllers/blogController.js';
import { upload } from '../middlewares/multer.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get("/", getAllBlogs);
router.get("/:blogId", getBlogById);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.post("/", upload.fields([{ name: 'featuredImage', maxCount: 1 }, { name: 'images', maxCount: 10 }]), createBlog);
router.put("/:blogId", upload.fields([{ name: 'featuredImage', maxCount: 1 }, { name: 'images', maxCount: 10 }]), updateBlog);
router.delete("/:blogId", deleteBlog);

export default router;

