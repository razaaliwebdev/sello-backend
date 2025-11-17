import express from 'express';
import {
    getChatbotConfig,
    updateChatbotConfig,
    getChatbotStats,
    getQuickReplies,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
    useQuickReply
} from '../controllers/chatbotController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

router.get("/config", getChatbotConfig);
router.put("/config", updateChatbotConfig);
router.get("/statistics", getChatbotStats);

// Quick Replies
router.get("/quick-replies", getQuickReplies);
router.post("/quick-replies", createQuickReply);
router.put("/quick-replies/:replyId", updateQuickReply);
router.delete("/quick-replies/:replyId", deleteQuickReply);
router.post("/quick-replies/:replyId/use", useQuickReply);

export default router;

