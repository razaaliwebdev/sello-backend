import User from '../models/userModel.js';
import Role from '../models/roleModel.js';

/**
 * Check if user has specific permission
 */
export const hasPermission = (permission) => {
    return async (req, res, next) => {
        try {
            // Original admins (adminRole is null/undefined) have full access
            // Super Admin role has full access
            // Users with inviteUsers permission have full access
            if (req.user.role === "admin") {
                if (!req.user.adminRole || req.user.adminRole === null || req.user.adminRole === "Super Admin") {
                    return next();
                }
                
                // Check if user has inviteUsers permission
                let userPermissions = {};
                if (req.user.roleId) {
                    const role = await Role.findById(req.user.roleId);
                    if (role && role.isActive) {
                        userPermissions = role.permissions || {};
                    }
                } else if (req.user.permissions) {
                    userPermissions = req.user.permissions;
                }
                
                if (userPermissions.inviteUsers === true) {
                    return next();
                }
            }

            // Get user's role and permissions
            let userPermissions = {};

            if (req.user.roleId) {
                const role = await Role.findById(req.user.roleId);
                if (role && role.isActive) {
                    userPermissions = role.permissions || {};
                }
            } else if (req.user.permissions) {
                userPermissions = req.user.permissions;
            }

            // Check if user has the required permission
            if (!userPermissions[permission]) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. You don't have permission to ${permission}.`
                });
            }

            next();
        } catch (error) {
            console.error("Permission Check Error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Permission check failed. Please try again.",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (...permissions) => {
    return async (req, res, next) => {
        try {
            // Original admins (adminRole is null/undefined) have full access
            // Super Admin role has full access
            // Users with inviteUsers permission have full access
            if (req.user.role === "admin") {
                if (!req.user.adminRole || req.user.adminRole === null || req.user.adminRole === "Super Admin") {
                    return next();
                }
                
                // Check if user has inviteUsers permission
                let userPermissions = {};
                if (req.user.roleId) {
                    const role = await Role.findById(req.user.roleId);
                    if (role && role.isActive) {
                        userPermissions = role.permissions || {};
                    }
                } else if (req.user.permissions) {
                    userPermissions = req.user.permissions;
                }
                
                if (userPermissions.inviteUsers === true) {
                    return next();
                }
            }

            // Get user's role and permissions
            let userPermissions = {};

            if (req.user.roleId) {
                const role = await Role.findById(req.user.roleId);
                if (role && role.isActive) {
                    userPermissions = role.permissions || {};
                }
            } else if (req.user.permissions) {
                userPermissions = req.user.permissions;
            }

            // Check if user has any of the required permissions
            const hasPermission = permissions.some(permission => userPermissions[permission]);

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. Insufficient permissions."
                });
            }

            next();
        } catch (error) {
            console.error("Permission Check Error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Permission check failed. Please try again.",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (...permissions) => {
    return async (req, res, next) => {
        try {
            // Original admins (adminRole is null/undefined) have full access
            // Super Admin role has full access
            // Users with inviteUsers permission have full access
            if (req.user.role === "admin") {
                if (!req.user.adminRole || req.user.adminRole === null || req.user.adminRole === "Super Admin") {
                    return next();
                }
                
                // Check if user has inviteUsers permission
                let userPermissions = {};
                if (req.user.roleId) {
                    const role = await Role.findById(req.user.roleId);
                    if (role && role.isActive) {
                        userPermissions = role.permissions || {};
                    }
                } else if (req.user.permissions) {
                    userPermissions = req.user.permissions;
                }
                
                if (userPermissions.inviteUsers === true) {
                    return next();
                }
            }

            // Get user's role and permissions
            let userPermissions = {};

            if (req.user.roleId) {
                const role = await Role.findById(req.user.roleId);
                if (role && role.isActive) {
                    userPermissions = role.permissions || {};
                }
            } else if (req.user.permissions) {
                userPermissions = req.user.permissions;
            }

            // Check if user has all of the required permissions
            const hasAll = permissions.every(permission => userPermissions[permission]);

            if (!hasAll) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. Insufficient permissions."
                });
            }

            next();
        } catch (error) {
            console.error("Permission Check Error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Permission check failed. Please try again.",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
};

/**
 * Check if user is Admin
 */
export const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Only admin can perform this action."
        });
    }
    next();
};
