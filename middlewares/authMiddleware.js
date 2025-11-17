import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

/**
 * Authentication Middleware
 * Verifies JWT token and checks user status
 */
export const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Check if authorization header exists
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. No token provided or invalid format."
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. Token is missing."
            });
        }

        // Verify token
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
        console.error("Auth Middleware Error:", error.message);
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

