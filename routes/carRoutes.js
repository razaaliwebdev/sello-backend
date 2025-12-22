import express from 'express';
import { createCar, deleteCar, editCar, getAllCars, getFilteredCars, getMyCars, getSingleCar, markCarAsSold, relistCar, getCarCountsByMake } from '../controllers/carController.js';
import { boostPost, adminPromotePost, getBoostOptions } from '../controllers/boostController.js';
import { upload } from '../middlewares/multer.js';
import { auth } from '../middlewares/authMiddleware.js';
import { searchLimiter } from '../middlewares/rateLimiter.js';
import { cache, cacheKeys, invalidateCache } from '../middlewares/cacheMiddleware.js';

const router = express.Router();


// Public Route - with caching
router.get("/", cache(300, cacheKeys.carListings), getAllCars); // Cache for 5 minutes
router.get("/filter", searchLimiter, cache(300, cacheKeys.carListings), getFilteredCars); // This needs to come before /:id - Rate limited to prevent abuse
router.get("/stats/counts-by-make", cache(1800, () => 'cache:cars:stats:counts-by-make'), getCarCountsByMake); // Brand statistics - Cache for 30 minutes
router.get("/:id", cache(600, cacheKeys.car), getSingleCar); // Cache for 10 minutes

// Protected Routes - invalidate cache on mutations
router.post("/", auth, upload.array("images"), async (req, res, next) => {
    await invalidateCache('cache:cars:*');
    next();
}, createCar);   // Create Car

router.put("/:id", auth, upload.array("images"), async (req, res, next) => {
    await invalidateCache(`cache:cars:${req.params.id}`);
    await invalidateCache('cache:cars:list:*');
    next();
}, editCar);  // Edit Car (with image upload support)

router.put("/:carId/sold", auth, async (req, res, next) => {
    await invalidateCache(`cache:cars:${req.params.carId}`);
    await invalidateCache('cache:cars:list:*');
    next();
}, markCarAsSold);  // Mark Car as Sold

router.post("/:carId/relist", auth, async (req, res, next) => {
    await invalidateCache(`cache:cars:${req.params.carId}`);
    await invalidateCache('cache:cars:list:*');
    next();
}, relistCar);  // Relist sold/expired car

router.delete("/:id", auth, async (req, res, next) => {
    await invalidateCache(`cache:cars:${req.params.id}`);
    await invalidateCache('cache:cars:list:*');
    next();
}, deleteCar);          // Delete Car
router.get('/my/listings', auth, getMyCars);    // GetMyCars (My Listing)

// Boost/Promote Routes
router.post("/:carId/boost", auth, boostPost);  // User boost post
router.get("/boost/options", auth, getBoostOptions);  // Get boost options
router.post("/:carId/admin-promote", auth, adminPromotePost);  // Admin promote post



export default router;