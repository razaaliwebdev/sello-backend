import express from "express";
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  inviteUser,
  getAllInvites,
  updateInvite,
  deleteInvite,
  resendInvite,
  getPermissionMatrix,
  initializeRoles,
  getInviteByToken,
  acceptInvite,
  fixCustomRoles,
} from "../controllers/roleController.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import { hasPermission } from "../middlewares/permissionMiddleware.js";

const router = express.Router();

// Public invite routes (no auth required)
router.get("/invite/:token", getInviteByToken);
router.post("/invite/:token/accept", acceptInvite);

// All other routes require authentication and admin role
router.use(auth);
router.use(authorize("admin"));

// Initialize roles (one-time setup) - requires createRoles permission
router.post("/initialize", hasPermission("createRoles"), initializeRoles);

// Fix custom roles that incorrectly have isPreset: true (temporary fix)
router.post("/fix-custom-roles", fixCustomRoles);

// Role management routes - require appropriate permissions
router.get("/", getAllRoles); // View roles - any admin
router.get("/matrix", getPermissionMatrix); // View matrix - any admin
router.get("/:roleId", getRoleById); // View role - any admin
router.post("/", createRole); // Create role - admin only (already checked in controller)
router.put("/:roleId", updateRole); // Update role - admin only (already checked in controller)
router.delete("/:roleId", deleteRole); // Delete role - admin only (already checked in controller)

// Invite management routes - admin only
router.post("/invite", inviteUser);
router.get("/invites/all", getAllInvites);
router.put("/invites/:inviteId", updateInvite); // Update invite
router.delete("/invites/:inviteId", deleteInvite); // Delete invite
router.post("/invites/:inviteId/resend", resendInvite); // Resend invite

export default router;
