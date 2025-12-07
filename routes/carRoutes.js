import express from 'express';
import { createCar, deleteCar, editCar, getAllCars, getFilteredCars, getMyCars, getSingleCar, markCarAsSold } from '../controllers/carController.js';
import { boostPost, adminPromotePost, getBoostOptions } from '../controllers/boostController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();


// Public Route
router.get("/", getAllCars);
router.get("/filter", getFilteredCars); // This needs to come before /:id
router.get("/:id", getSingleCar);

// Protected Routes
router.post("/", auth, upload.array("images"), createCar);   // Create Car
router.put("/:id", auth, upload.array("images"), editCar);  // Edit Car (with image upload support)
router.put("/:carId/sold", auth, markCarAsSold);  // Mark Car as Sold
router.delete("/:id", auth, deleteCar);          // Delete Car
router.get('/my/listings', auth, getMyCars);    // GetMyCars (My Listing)

// Boost/Promote Routes
router.post("/:carId/boost", auth, boostPost);  // User boost post
router.get("/boost/options", auth, getBoostOptions);  // Get boost options
router.post("/:carId/admin-promote", auth, adminPromotePost);  // Admin promote post



export default router;