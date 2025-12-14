import Settings from '../models/settingsModel.js';

/**
 * Maintenance Mode Middleware
 * Blocks all non-admin users when maintenance mode is enabled
 * Should be used before auth middleware for public routes,
 * or after auth middleware for protected routes
 */
export const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Allow login route so admins can still login during maintenance
        if (req.path === '/api/auth/login' || req.path === '/login') {
            return next();
        }

        // Check if maintenance mode is enabled
        const maintenanceSetting = await Settings.findOne({ key: 'maintenanceMode' });
        const isMaintenanceMode = maintenanceSetting && 
            (maintenanceSetting.value === true || 
             maintenanceSetting.value === 'true' || 
             maintenanceSetting.value === 1 || 
             maintenanceSetting.value === '1');

        if (!isMaintenanceMode) {
            // Maintenance mode is off, proceed normally
            return next();
        }

        // Maintenance mode is on - check if user is admin
        // If req.user exists (from auth middleware), check role
        if (req.user && req.user.role === 'admin') {
            // Admin users can bypass maintenance mode
            return next();
        }

        // Maintenance mode is on and user is not admin
        return res.status(503).json({
            success: false,
            message: "The platform is currently under maintenance. Please try again later.",
            maintenanceMode: true
        });
    } catch (error) {
        // If there's an error checking settings, allow the request to proceed
        // This prevents maintenance mode from breaking the site if there's a DB issue
        console.error("Maintenance Mode Check Error:", error.message);
        return next();
    }
};

