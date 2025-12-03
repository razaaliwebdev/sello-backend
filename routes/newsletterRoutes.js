import express from 'express';
import {
    subscribeNewsletter,
    unsubscribeNewsletter,
    getAllSubscribers
} from '../controllers/newsletterController.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/subscribe', subscribeNewsletter);
router.post('/unsubscribe', unsubscribeNewsletter);

// Admin routes
router.get('/subscribers', auth, getAllSubscribers);

export default router;

