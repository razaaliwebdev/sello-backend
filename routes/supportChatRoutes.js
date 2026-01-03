import express from "express";
import {
  createSupportChat,
  getUserSupportChats,
  getSupportChatMessages,
  sendSupportMessage,
  getAllSupportChats,
  sendAdminResponse,
  updateSupportChatStatus,
  editSupportMessage,
  deleteSupportMessage,
} from "../controllers/supportChatController.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

// User routes
router.post("/", auth, createSupportChat);
router.get("/my-chats", auth, getUserSupportChats);
router.get("/:chatId/messages", auth, getSupportChatMessages);
router.post(
  "/:chatId/messages",
  auth,
  upload.array("attachments", 5),
  sendSupportMessage
);
router.put("/messages/:messageId", auth, editSupportMessage);
router.delete("/messages/:messageId", auth, deleteSupportMessage);

// Admin routes
router.use(auth);
router.use(authorize("admin"));

router.get("/", getAllSupportChats);
router.post(
  "/:chatId/admin-response",
  upload.array("attachments", 5),
  sendAdminResponse
);
router.put("/:chatId/status", updateSupportChatStatus);

export default router;
