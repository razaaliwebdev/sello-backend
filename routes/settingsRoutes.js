import express from 'express';
import {
    getAllSettings,
    getSetting,
    upsertSetting,
    deleteSetting
} from '../controllers/settingsController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

router.get("/", getAllSettings);
router.get("/:key", getSetting);
router.post("/", upsertSetting);
router.put("/:key", upsertSetting);
router.delete("/:key", deleteSetting);

export default router;

