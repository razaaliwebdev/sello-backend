/**
 * Request Timeout Middleware
 * Prevents long-running requests from hanging with intelligent timeout handling
 */

import Logger from "../utils/logger.js";

/**
 * Intelligent request timeout middleware
 * @param {number} defaultTimeoutMs - Default timeout in milliseconds (default: 30 seconds)
 */
export const requestTimeout = (defaultTimeoutMs = 30000) => {
  return (req, res, next) => {
    // Determine timeout based on request type and method
    let timeoutMs = defaultTimeoutMs;

    // Longer timeouts for admin operations and file uploads
    if (req.path.startsWith("/api/admin")) {
      timeoutMs = 60000; // 60 seconds for admin operations
    } else if (req.path.includes("/upload") || req.path.includes("/import")) {
      timeoutMs = 120000; // 2 minutes for file operations
    } else if (req.method === "DELETE" && req.path.includes("/role")) {
      timeoutMs = 75000; // 75 seconds for role deletion (increased from 45s)
    } else if (
      req.path.includes("/analytics") ||
      req.path.includes("/reports")
    ) {
      timeoutMs = 90000; // 90 seconds for analytics
    }

    // Set timeout
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        Logger.warn("Request timeout", {
          method: req.method,
          url: req.originalUrl || req.url,
          timeout: timeoutMs,
          userAgent: req.headers["user-agent"],
          ip: req.ip || req.headers["x-forwarded-for"],
        });
        res.status(408).json({
          success: false,
          message: "Request timeout. The operation took too long to complete.",
          code: "REQUEST_TIMEOUT",
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on("finish", () => {
      clearTimeout(timeout);
    });

    res.on("close", () => {
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
      reject(new Error("Database query timeout"));
    }, timeoutMs);
  });

  return Promise.race([queryPromise, timeoutPromise]);
};
