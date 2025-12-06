import express from 'express';
import {
    createCarChat,
    getCarChats,
    getSellerBuyerChats,
    getCarChatMessages,
    sendCarChatMessage,
    editCarChatMessage,
    deleteCarChatMessage,
    getCarChatByCarId,
    blockUserInChat,
    unblockUser,
    getBlockedUsers
} from '../controllers/carChatController.js';
import { auth } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/multer.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get or create chat for a car
router.post("/car/:carId", createCarChat);
router.get("/car/:carId", getCarChatByCarId);

// Get user's car chats (for buyers)
router.get("/my-chats", getCarChats);

// Get seller's buyer chats (for sellers/dealers)
router.get("/seller/chats", getSellerBuyerChats);

// Get messages for a chat
router.get("/:chatId/messages", getCarChatMessages);

// Send message
router.post("/:chatId/messages", upload.array("attachments", 5), sendCarChatMessage);

// Edit message (own messages only)
router.put("/messages/:messageId", editCarChatMessage);

// Delete message (own messages only)
router.delete("/messages/:messageId", deleteCarChatMessage);

// Block/Unblock users
router.post("/block/:userId", blockUserInChat);
router.delete("/block/:userId", unblockUser);
router.get("/blocked", getBlockedUsers);

export default router;

