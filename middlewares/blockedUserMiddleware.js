/**
 * Blocked User Middleware
 * Ensures blocked users cannot interact with each other
 */

import User from '../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Check if user is blocked
 */
export const checkBlockedUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return next();
        }

        // Get target user ID from params or body
        const targetUserId = req.params.userId || req.params.sellerId || req.body.targetUserId || req.body.sellerId;
        
        if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
            return next();
        }

        // Check if current user has blocked target
        const currentUser = await User.findById(req.user._id).select('blockedUsers');
        if (currentUser && currentUser.blockedUsers && currentUser.blockedUsers.includes(targetUserId)) {
            return res.status(403).json({
                success: false,
                message: "You have blocked this user. Unblock them to interact."
            });
        }

        // Check if target user has blocked current user
        const targetUser = await User.findById(targetUserId).select('blockedUsers');
        if (targetUser && targetUser.blockedUsers && targetUser.blockedUsers.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "This user has blocked you."
            });
        }

        next();
    } catch (error) {
        console.error('Blocked user check error:', error);
        next(); // Continue on error to avoid blocking legitimate requests
    }
};

/**
 * Filter blocked users from results
 */
export const filterBlockedUsers = async (userId, userList) => {
    try {
        if (!userId || !userList || userList.length === 0) {
            return userList;
        }

        const user = await User.findById(userId).select('blockedUsers');
        if (!user || !user.blockedUsers || user.blockedUsers.length === 0) {
            return userList;
        }

        const blockedIds = user.blockedUsers.map(id => id.toString());
        return userList.filter(u => {
            const userId = u._id?.toString() || u.toString();
            return !blockedIds.includes(userId);
        });
    } catch (error) {
        console.error('Filter blocked users error:', error);
        return userList; // Return original list on error
    }
};

