import express from 'express';
import {
    createTestimonial,
    getAllTestimonials,
    getTestimonialById,
    updateTestimonial,
    deleteTestimonial
} from '../controllers/testimonialController.js';
import { upload } from '../middlewares/multer.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes (for frontend)
router.get("/", getAllTestimonials);
router.get("/:testimonialId", getTestimonialById);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.post("/", upload.single('image'), createTestimonial);
router.put("/:testimonialId", upload.single('image'), updateTestimonial);
router.delete("/:testimonialId", deleteTestimonial);

export default router;

