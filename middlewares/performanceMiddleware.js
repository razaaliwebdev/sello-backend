/**
 * Performance Monitoring Middleware
 * Tracks response times and database query performance
 */

import Logger from '../utils/logger.js';

/**
 * Request performance monitoring
 */
export const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    
    // Track response time
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        Logger.request(req, res, responseTime);
        
        // Log slow requests
        if (responseTime > 2000) {
            Logger.warn('Slow API Response', {
                method: req.method,
                url: req.originalUrl,
                responseTime: `${responseTime}ms`
            });
        }
    });
    
    next();
};

/**
 * Database query monitoring wrapper
 */
export const monitorQuery = async (operation, collection, queryFn) => {
    const startTime = Date.now();
    try {
        const result = await queryFn();
        const duration = Date.now() - startTime;
        Logger.query(operation, collection, duration);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.query(operation, collection, duration, { error: error.message });
        throw error;
    }
};

