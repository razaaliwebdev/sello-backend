/**
 * Centralized Logging Utility
 * Provides structured logging for errors, warnings, and info
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Get log file path for today
 */
const getLogFile = (type = 'app') => {
    const today = new Date().toISOString().split('T')[0];
    return path.join(logsDir, `${type}-${today}.log`);
};

/**
 * Format log message with timestamp and metadata
 */
const formatLog = (level, message, metadata = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...metadata
    };
    return JSON.stringify(logEntry) + '\n';
};

/**
 * Write to log file
 */
const writeLog = (type, level, message, metadata) => {
    try {
        const logFile = getLogFile(type);
        const logEntry = formatLog(level, message, metadata);
        fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (error) {
        console.error('Failed to write log:', error);
    }
};

/**
 * Logger class
 */
class Logger {
    /**
     * Log error
     */
    static error(message, error = null, metadata = {}) {
        const errorData = {
            ...metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            } : null
        };
        
        writeLog('error', 'ERROR', message, errorData);
        console.error(`[ERROR] ${message}`, error || '');
    }

    /**
     * Log warning
     */
    static warn(message, metadata = {}) {
        writeLog('app', 'WARN', message, metadata);
        console.warn(`[WARN] ${message}`, metadata);
    }

    /**
     * Log info
     */
    static info(message, metadata = {}) {
        writeLog('app', 'INFO', message, metadata);
        if (process.env.NODE_ENV === 'development') {
            console.log(`[INFO] ${message}`, metadata);
        }
    }

    /**
     * Log debug (only in development)
     */
    static debug(message, metadata = {}) {
        if (process.env.NODE_ENV === 'development') {
            writeLog('app', 'DEBUG', message, metadata);
            console.debug(`[DEBUG] ${message}`, metadata);
        }
    }

    /**
     * Log API request
     */
    static request(req, res, responseTime) {
        const logData = {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?._id?.toString()
        };
        
        if (res.statusCode >= 400) {
            writeLog('error', 'ERROR', 'API Request Error', logData);
        } else {
            writeLog('app', 'INFO', 'API Request', logData);
        }
    }

    /**
     * Log database query
     */
    static query(operation, collection, duration, metadata = {}) {
        if (duration > 1000) { // Log slow queries
            writeLog('app', 'WARN', 'Slow Database Query', {
                operation,
                collection,
                duration: `${duration}ms`,
                ...metadata
            });
        }
    }

    /**
     * Log analytics event
     */
    static analytics(event, userId, metadata = {}) {
        writeLog('analytics', 'INFO', event, {
            userId: userId?.toString(),
            ...metadata
        });
    }

    /**
     * Log security event
     */
    static security(event, metadata = {}) {
        writeLog('security', 'WARN', event, metadata);
        console.warn(`[SECURITY] ${event}`, metadata);
    }
}

export default Logger;

