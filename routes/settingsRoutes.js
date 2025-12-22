import express from 'express';
import {
    getAllSettings,
    getSetting,
    upsertSetting,
    deleteSetting
} from '../controllers/settingsController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import { hasPermission } from '../middlewares/permissionMiddleware.js';

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

// Get routes - only need admin role
router.get("/", getAllSettings);
router.get("/:key", getSetting);

// Update/Delete routes - require managePlatformSettings permission
router.post("/", hasPermission('managePlatformSettings'), upsertSetting);
router.put("/:key", hasPermission('managePlatformSettings'), upsertSetting);
router.delete("/:key", hasPermission('managePlatformSettings'), deleteSetting);

export default router;

