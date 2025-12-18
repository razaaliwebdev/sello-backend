import express from 'express';
import {
    getUserProfile,
    updateProfile,
    updateDealerProfile,
    getBoostCredits,
    saveCar,
    unsaveCar,
    getSavedCars,
    requestSeller,
    requestDealer
} from '../controllers/userController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// User Profile Routes
router.get("/me", getUserProfile);
router.put("/profile", upload.single("avatar"), updateProfile);
router.put("/dealer-profile", upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 },
    { name: 'showroomImages', maxCount: 10 }
]), updateDealerProfile);
router.get("/boost-credits", getBoostCredits);

import { addReview, getUserReviews } from '../controllers/reviewController.js';
import { createReport } from '../controllers/reportController.js';

// Saved Cars/Wishlist Routes
router.post("/save-car/:carId", saveCar);
router.delete("/unsave-car/:carId", unsaveCar);
router.get("/saved-cars", getSavedCars);

// Review Routes
router.post("/reviews", addReview);
router.get("/reviews/:userId", getUserReviews);

// Report Routes
router.post("/report", createReport);

// Seller & Dealer Routes
router.post("/request-seller", requestSeller);
router.post("/request-dealer", upload.fields([
    { name: 'businessLicense', maxCount: 1 }
]), requestDealer);

export default router;
