import express from 'express';
import {
    submitContactForm,
    getAllContactForms,
    getContactFormById,
    convertToChat,
    updateContactFormStatus,
    deleteContactForm
} from '../controllers/contactFormController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - submit contact form
router.post("/", submitContactForm);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.get("/", getAllContactForms);
router.get("/:id", getContactFormById);
router.post("/:id/convert-to-chat", convertToChat);
router.put("/:id/status", updateContactFormStatus);
router.delete("/:id", deleteContactForm);

export default router;

