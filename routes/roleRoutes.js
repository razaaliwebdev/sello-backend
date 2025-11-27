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

const router = express.Router();

// Public invite routes (no auth required)
router.get('/invite/:token', getInviteByToken);
router.post('/invite/:token/accept', acceptInvite);

// All other routes require authentication and admin role
router.use(auth);
router.use(authorize('admin'));

// Initialize roles (one-time setup)
router.post('/initialize', initializeRoles);

// Role management routes
router.get('/', getAllRoles);
router.get('/matrix', getPermissionMatrix);
router.get('/:roleId', getRoleById);
router.post('/', createRole);
router.put('/:roleId', updateRole);
router.delete('/:roleId', deleteRole);

// Invite management routes (admin only)
router.post('/invite', inviteUser);
router.get('/invites/all', getAllInvites);

export default router;

