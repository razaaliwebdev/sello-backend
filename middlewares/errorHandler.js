/**
 * Global Error Handler Middleware
 * Handles all errors in a centralized way
 */

import Logger from "../utils/logger.js";

/**
 * Custom Error class for application errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * Must be added after all routes
 */
export const errorHandler = (err, req, res, next) => {
  // Prevent double response sending
  if (res.headersSent) {
    Logger.error("Error Handler - Response already sent", err, {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?._id?.toString(),
    });
    return;
  }

  // Set default error values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error
  if (err.statusCode >= 500) {
    Logger.error("Server Error", err, {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?._id?.toString(),
    });
  } else {
    Logger.warn("Client Error", {
      message: err.message,
      statusCode: err.statusCode,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?._id?.toString(),
    });
  }

  // Send error response
  if (process.env.NODE_ENV === "production") {
    // In production, don't leak error details
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message || "Something went wrong",
        ...(err.statusCode === 400 && err.errors ? { errors: err.errors } : {}),
      });
    } else {
      // Programming or unknown errors
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again later.",
      });
    }
  } else {
    // In development, send full error details
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || "Something went wrong",
      error: err.message,
      stack: err.stack,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(err);
};

/**
 * Handle async errors
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle validation errors
 */
export const validationErrorHandler = (err, req, res, next) => {
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors,
    });
  }
  next(err);
};

/**
 * Handle MongoDB duplicate key errors
 */
export const duplicateKeyErrorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
      field,
    });
  }
  next(err);
};

/**
 * Handle MongoDB cast errors (invalid ObjectId)
 */
export const castErrorHandler = (err, req, res, next) => {
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }
  next(err);
};
