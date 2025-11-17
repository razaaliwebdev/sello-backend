import express from 'express';
import {
    createNotification,
    getAllNotifications,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../controllers/notificationController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// User routes
router.get("/me", getUserNotifications);
router.put("/:notificationId/read", markAsRead);
router.put("/read-all", markAllAsRead);

// Admin routes
router.use(authorize('admin'));

router.post("/", createNotification);
router.get("/", getAllNotifications);
router.delete("/:notificationId", deleteNotification);

export default router;

