import express from 'express';
import {
    getDashboardStats,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getAllCars,
    approveCar,
    deleteCar,
    featureCar,
    getAllDealers,
    verifyUser,
    verifyDealer,
    getListingHistory
} from '../controllers/adminController.js';
import {
    getAllPayments,
    getAllSubscriptions,
    adminUpdateSubscription,
    adminCancelSubscription
} from '../controllers/adminPaymentController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth);
router.use(authorize('admin'));

// Dashboard
router.get("/dashboard", getDashboardStats);

// User Management
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.put("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);
router.put("/users/:userId/verify", verifyUser);

// Listings (Cars) Management
router.get("/listings", getAllCars);
router.put("/listings/:carId/approve", approveCar);
router.put("/listings/:carId/feature", featureCar);
router.delete("/listings/:carId", deleteCar);
router.get("/listings/history", getListingHistory);

// Dealer Management
router.get("/dealers", getAllDealers);
router.put("/dealers/:userId/verify", verifyDealer);

// Customer Management (same as users but filtered)
router.get("/customers", getAllUsers); // Can filter by role=buyer in query

// Payment Management
router.get("/payments", getAllPayments);
router.get("/subscriptions", getAllSubscriptions);
router.put("/subscriptions/:userId", adminUpdateSubscription);
router.delete("/subscriptions/:userId", adminCancelSubscription);

export default router;

