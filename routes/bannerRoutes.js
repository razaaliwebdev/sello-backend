import express from 'express';
import {
    createBanner,
    getAllBanners,
    getBannerById,
    updateBanner,
    deleteBanner
} from '../controllers/bannerController.js';
import { upload } from '../middlewares/multer.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes (for frontend)
router.get("/", getAllBanners);
router.get("/:bannerId", getBannerById);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.post("/", upload.single('image'), createBanner);
router.put("/:bannerId", upload.single('image'), updateBanner);
router.delete("/:bannerId", deleteBanner);

export default router;

