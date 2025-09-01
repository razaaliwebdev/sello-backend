import express from 'express';
import { createCar, deleteCar, editCar, getAllCars, getFilteredCars, getMyCars, getSingleCar } from '../controllers/carController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();


// Public Route
router.get("/", getAllCars);
router.get("/filter", getFilteredCars); // This needs to come before /:id
router.get("/:id", getSingleCar);

// Protected Routes
router.post("/", auth, upload.array("images"), createCar);   // Create Car
router.put("/:id", auth, editCar);                // Edit Car  
router.delete("/:id", auth, deleteCar);          // Delete Car
router.get('/my/listings', auth, getMyCars);    // GetMyCars (My Listing)



export default router;