import express from 'express';
import {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    inviteUser,
    getAllInvites,
    getPermissionMatrix,
    initializeRoles,
    getInviteByToken,
    acceptInvite
} from '../controllers/roleController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import { hasPermission } from '../middlewares/permissionMiddleware.js';

const router = express.Router();

// Public invite routes (no auth required)
router.get('/invite/:token', getInviteByToken);
router.post('/invite/:token/accept', acceptInvite);

// All other routes require authentication and admin role
router.use(auth);
router.use(authorize('admin'));

// Initialize roles (one-time setup) - requires createRoles permission
router.post('/initialize', hasPermission('createRoles'), initializeRoles);

// Role management routes - require appropriate permissions
router.get('/', getAllRoles); // View roles - any admin
router.get('/matrix', getPermissionMatrix); // View matrix - any admin
router.get('/:roleId', getRoleById); // View role - any admin
router.post('/', hasPermission('createRoles'), createRole); // Create role - requires permission
router.put('/:roleId', hasPermission('editRoles'), updateRole); // Update role - requires permission
router.delete('/:roleId', hasPermission('deleteRoles'), deleteRole); // Delete role - requires permission

// Invite management routes - require inviteUsers permission
router.post('/invite', hasPermission('inviteUsers'), inviteUser);
router.get('/invites/all', hasPermission('manageUsers'), getAllInvites);

export default router;

