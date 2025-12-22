import express from 'express';
import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from '../controllers/categoryController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import { hasPermission } from '../middlewares/permissionMiddleware.js';
import { upload } from '../middlewares/multer.js';

const router = express.Router();

// Public routes
router.get("/", getAllCategories);
router.get("/:categoryId", getCategoryById);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

// Category management requires manageCategories permission
router.post("/", hasPermission('manageCategories'), upload.single('image'), createCategory);
router.put("/:categoryId", hasPermission('manageCategories'), upload.single('image'), updateCategory);
router.delete("/:categoryId", hasPermission('manageCategories'), deleteCategory);

export default router;

