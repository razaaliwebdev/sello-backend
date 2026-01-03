import express from "express";
import {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllCars,
  approveCar,
  deleteCar,
  featureCar,
  getAllDealers,
  verifyUser,
  verifyDealer,
  getListingHistory,
  getAuditLogsController,
} from "../controllers/adminController.js";
import {
  getAllPayments,
  getAllSubscriptions,
  adminUpdateSubscription,
  adminCancelSubscription,
} from "../controllers/adminPaymentController.js";
import {
  getAllSupportChats,
  getSupportChatMessagesAdmin,
  sendAdminResponse,
  updateSupportChatStatus,
  createAdminChatWithUser,
  deleteSupportChat,
} from "../controllers/supportChatController.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import { hasPermission } from "../middlewares/permissionMiddleware.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth);
router.use(authorize("admin"));

// Dashboard - any admin can view
router.get("/dashboard", getDashboardStats);

// User Management - require manageUsers permission
router.get("/users", hasPermission("manageUsers"), getAllUsers);
router.get("/users/:userId", hasPermission("manageUsers"), getUserById);
router.put("/users/:userId", hasPermission("manageUsers"), updateUser);
router.delete("/users/:userId", hasPermission("manageUsers"), deleteUser);
router.put("/users/:userId/verify", hasPermission("manageUsers"), verifyUser);

// Listings (Cars) Management - require viewListings permission
router.get("/listings", hasPermission("viewListings"), getAllCars);
router.put(
  "/listings/:carId/approve",
  hasPermission("approveListings"),
  approveCar
);
router.put(
  "/listings/:carId/feature",
  hasPermission("featureListings"),
  featureCar
);
router.delete("/listings/:carId", hasPermission("deleteListings"), deleteCar);
router.get(
  "/listings/history",
  hasPermission("viewListings"),
  getListingHistory
);

// Dealer Management - require viewDealers permission
router.get("/dealers", hasPermission("viewDealers"), getAllDealers);
router.put(
  "/dealers/:userId/verify",
  hasPermission("approveDealers"),
  verifyDealer
);

// Customer Management - require manageUsers permission
router.get("/customers", hasPermission("manageUsers"), getAllUsers);

// Payment Management - require viewFinancialReports permission
router.get("/payments", hasPermission("viewFinancialReports"), getAllPayments);
router.get(
  "/subscriptions",
  hasPermission("viewFinancialReports"),
  getAllSubscriptions
);
router.put(
  "/subscriptions/:userId",
  hasPermission("viewFinancialReports"),
  adminUpdateSubscription
);
router.delete(
  "/subscriptions/:userId",
  hasPermission("viewFinancialReports"),
  adminCancelSubscription
);

// Audit Logs - require manageUsers permission
router.get("/audit-logs", hasPermission("manageUsers"), getAuditLogsController);

// Chat Management - require manageUsers permission
router.get("/support-chats", hasPermission("manageUsers"), getAllSupportChats);
router.get("/support-chats-debug", auth, async (req, res) => {
  try {
    const Chat = (await import("../models/chatModel.js")).Chat;
    const chats = await Chat.find({ chatType: "support" })
      .populate("participants", "name email avatar role")
      .limit(5);

    console.log("Debug - Support chats found:", chats.length);
    chats.forEach((chat, index) => {
      console.log(`Chat ${index + 1}:`, {
        _id: chat._id,
        participants: chat.participants.map((p) => ({
          _id: p._id,
          name: p.name,
          role: p.role,
          email: p.email,
        })),
        subject: chat.subject,
        lastMessage: chat.lastMessage,
      });
    });

    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
router.get(
  "/support-chats/:chatId/messages",
  hasPermission("manageUsers"),
  getSupportChatMessagesAdmin
);
router.post(
  "/support-chats/:chatId/admin-response",
  hasPermission("manageUsers"),
  sendAdminResponse
);
router.put(
  "/support-chats/:chatId/status",
  hasPermission("manageUsers"),
  updateSupportChatStatus
);
router.delete(
  "/support-chats/:chatId",
  hasPermission("manageUsers"),
  deleteSupportChat
);
router.post(
  "/start-chat/:userId",
  hasPermission("manageUsers"),
  createAdminChatWithUser
);

export default router;
