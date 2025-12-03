import express from 'express';
import {
    createTestimonial,
    createPublicReview,
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
// Public review submission (authenticated users can submit) - must be before /:testimonialId
router.post("/submit", auth, upload.single('image'), createPublicReview);
router.get("/:testimonialId", getTestimonialById);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.post("/", upload.single('image'), createTestimonial);
router.put("/:testimonialId", upload.single('image'), updateTestimonial);
router.delete("/:testimonialId", deleteTestimonial);

export default router;

