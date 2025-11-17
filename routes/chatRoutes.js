import express from 'express';
import {
    getAllChats,
    getChatMessages,
    reportChat,
    deleteChat,
    getChatStatistics,
    sendChatMessage,
    deleteMessage,
    editMessage,
    getAllMessages
} from '../controllers/chatController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

router.get("/", getAllChats);
router.get("/statistics", getChatStatistics);
router.get("/messages/all", getAllMessages);
router.get("/:chatId/messages", getChatMessages);
router.post("/:chatId/messages", sendChatMessage);
router.put("/:chatId/report", reportChat);
router.delete("/:chatId", deleteChat);
router.delete("/messages/:messageId", deleteMessage);
router.put("/messages/:messageId", editMessage);

export default router;

