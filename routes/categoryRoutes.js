import express from 'express';
import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from '../controllers/categoryController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/multer.js';

const router = express.Router();

// Public routes
router.get("/", getAllCategories);
router.get("/:categoryId", getCategoryById);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.post("/", upload.single('image'), createCategory);
router.put("/:categoryId", upload.single('image'), updateCategory);
router.delete("/:categoryId", deleteCategory);

export default router;

