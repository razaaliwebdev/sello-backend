/**
 * Security Middleware
 * Additional security checks and validations
 */

import Logger from '../utils/logger.js';
import { isValidObjectId } from './sanitizeMiddleware.js';

/**
 * Rate limiting helper (simple in-memory, use Redis in production)
 */
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // Max requests per window

export const rateLimit = (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(key)) {
        requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    const record = requestCounts.get(key);
    
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
        return next();
    }
    
    if (record.count >= RATE_LIMIT_MAX) {
        Logger.security('Rate limit exceeded', { ip: key, count: record.count });
        return res.status(429).json({
            success: false,
            message: "Too many requests. Please try again later."
        });
    }
    
    record.count++;
    next();
};

/**
 * Validate file upload security
 */
export const validateFileUpload = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next();
    }

    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
    ];

    const maxFileSize = 20 * 1024 * 1024; // 20MB

    for (const file of req.files) {
        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
            Logger.security('Invalid file type uploaded', {
                mimetype: file.mimetype,
                filename: file.originalname,
                userId: req.user?._id
            });
            return res.status(400).json({
                success: false,
                message: `Invalid file type: ${file.mimetype}. Only images are allowed.`
            });
        }

        // Check file size
        if (file.size > maxFileSize) {
            Logger.security('File too large uploaded', {
                size: file.size,
                filename: file.originalname,
                userId: req.user?._id
            });
            return res.status(400).json({
                success: false,
                message: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 20MB.`
            });
        }

        // Check for suspicious file names
        if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
            Logger.security('Suspicious filename detected', {
                filename: file.originalname,
                userId: req.user?._id
            });
            return res.status(400).json({
                success: false,
                message: "Invalid filename."
            });
        }
    }

    next();
};

/**
 * Validate ObjectId parameters
 */
export const validateObjectIds = (paramNames = ['id']) => {
    return (req, res, next) => {
        for (const paramName of paramNames) {
            const id = req.params[paramName] || req.body[paramName] || req.query[paramName];
            if (id && !isValidObjectId(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid ${paramName}. Must be a valid MongoDB ObjectId.`
                });
            }
        }
        next();
    };
};

/**
 * Check Cloudinary access (ensure proper folder structure)
 */
export const validateCloudinaryAccess = (folder) => {
    return (req, res, next) => {
        // In production, you might want to validate Cloudinary credentials
        // and ensure proper folder access
        req.cloudinaryFolder = folder || 'sello_cars';
        next();
    };
};

