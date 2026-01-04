/**
 * Performance Monitoring Middleware
 * Tracks response times and database query performance
 * Enhanced with request ID tracking and detailed metrics
 */

import Logger from "../utils/logger.js";

/**
 * Request performance monitoring
 */
export const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.id || req.requestId || "unknown";

  // Add performance tracking to response
  res.locals.startTime = startTime;

  // Helper function to set response time header before response is sent
  const setResponseTimeHeader = () => {
    if (!res.headersSent) {
      const responseTime = Date.now() - startTime;
      res.setHeader("X-Response-Time", `${responseTime}ms`);
    }
  };

  // Intercept res.end to set header before response is sent
  const originalEnd = res.end;
  res.end = function (...args) {
    if (!res.headersSent) {
      setResponseTimeHeader();
    }
    return originalEnd.apply(this, args);
  };

  // Intercept res.send to set header (Express uses this internally)
  const originalSend = res.send;
  res.send = function (...args) {
    if (!res.headersSent) {
      setResponseTimeHeader();
    }
    return originalSend.apply(this, args);
  };

  // Intercept res.json to set header
  const originalJson = res.json;
  res.json = function (...args) {
    if (!res.headersSent) {
      setResponseTimeHeader();
    }
    return originalJson.apply(this, args);
  };

  // Track response time for logging (after response is sent)
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;

    // Enhanced logging with request ID
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("user-agent"),
      userId: req.user?._id?.toString(),
    };

    // Log request with performance data
    Logger.request(req, res, responseTime);

    // Log slow requests with more detail
    if (responseTime > 2000) {
      Logger.warn("Slow API Response", {
        ...logData,
        threshold: "2000ms",
      });
    }

    // Log very slow requests as errors
    if (responseTime > 5000) {
      Logger.error("Very Slow API Response", null, {
        ...logData,
        threshold: "5000ms",
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
