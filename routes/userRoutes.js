import express from 'express';
import {
    getUserProfile,
    updateProfile,
    getBoostCredits,
    saveCar,
    unsaveCar,
    getSavedCars
} from '../controllers/userController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// User Profile Routes
router.get("/me", getUserProfile);
router.put("/profile", upload.single("avatar"), updateProfile);
router.get("/boost-credits", getBoostCredits);

// Saved Cars/Wishlist Routes
router.post("/save-car/:carId", saveCar);
router.delete("/unsave-car/:carId", unsaveCar);
router.get("/saved-cars", getSavedCars);

export default router;
