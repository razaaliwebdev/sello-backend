/**
 * Request Timeout Middleware
 * Prevents long-running requests from hanging
 */

import Logger from '../utils/logger.js';

/**
 * Request timeout middleware
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30 seconds)
 */
export const requestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        // Set timeout
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                Logger.warn('Request timeout', {
                    method: req.method,
                    url: req.originalUrl || req.url,
                    timeout: timeoutMs
                });
                res.status(504).json({
                    success: false,
                    message: 'Request timeout. Please try again.'
                });
            }
        }, timeoutMs);

        // Clear timeout when response is sent
        res.on('finish', () => {
            clearTimeout(timeout);
        });

        res.on('close', () => {
            clearTimeout(timeout);
        });

        next();
    };
};

/**
 * Query timeout helper for MongoDB queries
 * @param {Promise} queryPromise - MongoDB query promise
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Query promise with timeout
 */
export const withQueryTimeout = async (queryPromise, timeoutMs = 10000) => {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Database query timeout'));
        }, timeoutMs);
    });

    return Promise.race([queryPromise, timeoutPromise]);
};

