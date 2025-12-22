/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DDoS attacks
 * Uses Redis for distributed rate limiting when available
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from '../utils/redisStore.js';
import redis from '../utils/redis.js';
import Logger from '../utils/logger.js';

/**
 * Get store for rate limiting
 * Uses Redis if available, otherwise falls back to memory
 */
function getStore() {
    if (redis.isAvailable()) {
        try {
            return new RedisStore();
        } catch (error) {
            Logger.warn('Failed to create Redis store, using memory store', { error: error.message });
            return undefined; // Use default memory store
        }
    }
    return undefined; // Use default memory store
}

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP (production)
 * 500 requests per 15 minutes per IP (development)
 * Uses Redis store when available
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 500, // Different limits for dev/prod
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: getStore(), // Use Redis if available
    // Skip rate limiting for admin users in development
    skip: (req) => {
        return process.env.NODE_ENV === 'development' && req.user?.role === 'admin';
    },
    // Custom key generator to include user ID if authenticated
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use IP with IPv6 support
        if (req.user?._id) {
            return req.user._id.toString();
        }
        // Use ipKeyGenerator helper for proper IPv6 support
        return ipKeyGenerator(req) || 'unknown';
    }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 * Uses Redis store when available
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'Too many login attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(), // Use Redis if available
    skipSuccessfulRequests: true, // Don't count successful requests
    keyGenerator: (req) => {
        // Always use IP for auth endpoints with IPv6 support
        return ipKeyGenerator(req) || 'unknown';
    }
});

/**
 * Rate limiter for password reset endpoints
 * 3 requests per hour per IP
 * Uses Redis store when available
 */
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset requests per hour
    message: {
        success: false,
        message: 'Too many password reset attempts, please try again after 1 hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(), // Use Redis if available
    keyGenerator: (req) => {
        // Use email if provided, otherwise IP with IPv6 support
        if (req.body?.email || req.headers?.email) {
            return req.body?.email || req.headers?.email;
        }
        return ipKeyGenerator(req) || 'unknown';
    }
});

/**
 * Rate limiter for file upload endpoints
 * 10 uploads per 15 minutes per IP
 * Uses Redis store when available
 */
export const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 uploads per windowMs
    message: {
        success: false,
        message: 'Too many file uploads, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(), // Use Redis if available
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP with IPv6 support
        if (req.user?._id) {
            return req.user._id.toString();
        }
        return ipKeyGenerator(req) || 'unknown';
    }
});

/**
 * Rate limiter for contact form submissions
 * 5 submissions per hour per IP
 * Uses Redis store when available
 */
export const contactFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 contact form submissions per hour
    message: {
        success: false,
        message: 'Too many contact form submissions, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(), // Use Redis if available
    keyGenerator: (req) => {
        // Use email if provided, otherwise IP with IPv6 support
        if (req.body?.email || req.headers?.email) {
            return req.body?.email || req.headers?.email;
        }
        return ipKeyGenerator(req) || 'unknown';
    }
});

/**
 * Rate limiter for search endpoints
 * 30 searches per minute per IP
 * Uses Redis store when available
 */
export const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 searches per minute
    message: {
        success: false,
        message: 'Too many search requests, please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(), // Use Redis if available
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP with IPv6 support
        if (req.user?._id) {
            return req.user._id.toString();
        }
        return ipKeyGenerator(req) || 'unknown';
    }
});

