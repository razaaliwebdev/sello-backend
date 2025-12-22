import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Logger from '../utils/logger.js';

/**
 * Authentication Middleware
 * Verifies JWT token and checks user status
 */
export const auth = async (req, res, next) => {
    try {
        let token = null;

        // Try to get token from Authorization header first
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        // Fallback: try to get token from cookies
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. No token provided or invalid format."
            });
        }

        // Verify token
        // Check if JWT_SECRET is configured (should be caught at startup, but check here as fallback)
        if (!process.env.JWT_SECRET) {
            Logger.error('JWT_SECRET not configured in auth middleware');
            return res.status(500).json({
                success: false,
                message: "Server configuration error. Please contact support."
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: "Token has expired. Please login again."
                });
            }
            return res.status(401).json({
                success: false,
                message: "Invalid token. Please login again."
            });
        }

        // Find user
        const user = await User.findById(decoded.id).select("-password -otp -otpExpiry");
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found. Token is invalid."
            });
        }

        // Check user status
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Please contact support to activate it."
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        Logger.error("Auth Middleware Error", error);
        return res.status(500).json({
            success: false,
            message: "Authentication error. Please try again.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Role-based Authorization Middleware
 * Use after auth middleware
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. Please login first."
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Insufficient permissions."
            });
        }

        next();
    };
};

