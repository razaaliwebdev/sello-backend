/**
 * Request ID Middleware
 * Adds a unique request ID to each request for tracking and logging
 */

import { randomUUID } from 'crypto';

/**
 * Generate and attach request ID to request and response
 */
export const requestIdMiddleware = (req, res, next) => {
    // Generate or use existing request ID
    const requestId = req.headers['x-request-id'] || randomUUID();
    
    // Attach to request
    req.id = requestId;
    req.requestId = requestId;
    
    // Add to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Add to response locals for logging
    res.locals.requestId = requestId;
    
    next();
};

export default requestIdMiddleware;

