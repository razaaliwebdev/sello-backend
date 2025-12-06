/**
 * Input Sanitization Middleware
 * Prevents XSS attacks and sanitizes user input
 */

/**
 * Sanitize string input - remove HTML tags and dangerous characters
 * @param {String} str - Input string
 * @returns {String} Sanitized string
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove HTML tags
    let sanitized = str.replace(/<[^>]*>/g, '');
    
    // Remove script tags and event handlers
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Escape special characters
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    
    return sanitized.trim();
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @param {Array} excludeFields - Fields to exclude from sanitization
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj, excludeFields = []) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, excludeFields));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Skip excluded fields (like passwords, tokens, HTML content from editors)
        if (excludeFields.includes(key)) {
            sanitized[key] = value;
            continue;
        }
        
        if (typeof value === 'string') {
            // Don't sanitize URLs, emails, or JSON strings
            if (
                key.toLowerCase().includes('url') ||
                key.toLowerCase().includes('email') ||
                key.toLowerCase().includes('link') ||
                key.toLowerCase().includes('image') ||
                key.toLowerCase().includes('avatar') ||
                key === 'geoLocation' ||
                key === 'content' || // Blog content from editor
                key === 'description' // Rich text descriptions
            ) {
                sanitized[key] = value;
            } else {
                sanitized[key] = sanitizeString(value);
            }
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value, excludeFields);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
};

/**
 * Middleware to sanitize request body, query, and params
 * @param {Array} excludeFields - Fields to exclude from sanitization
 */
export const sanitizeInput = (excludeFields = []) => {
    return (req, res, next) => {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body, excludeFields);
        }
        
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            req.query = sanitizeObject(req.query, excludeFields);
        }
        
        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params, excludeFields);
        }
        
        next();
    };
};

/**
 * Sanitize specific field
 * @param {String} field - Field name to sanitize
 */
export const sanitizeField = (field) => {
    return (req, res, next) => {
        if (req.body && req.body[field] && typeof req.body[field] === 'string') {
            req.body[field] = sanitizeString(req.body[field]);
        }
        next();
    };
};

/**
 * Validate and sanitize MongoDB ObjectId
 * @param {String} id - ID to validate
 * @returns {Boolean} True if valid
 */
export const isValidObjectId = (id) => {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Middleware to validate ObjectId parameters
 */
export const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName] || req.body[paramName] || req.query[paramName];
        
        if (id && !isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName}. Must be a valid MongoDB ObjectId.`
            });
        }
        
        next();
    };
};

