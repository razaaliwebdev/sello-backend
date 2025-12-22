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
import { contactFormLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public route - submit contact form with rate limiting
router.post("/", contactFormLimiter, submitContactForm);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.get("/", getAllContactForms);
router.get("/:id", getContactFormById);
router.post("/:id/convert-to-chat", convertToChat);
router.put("/:id/status", updateContactFormStatus);
router.delete("/:id", deleteContactForm);

export default router;

