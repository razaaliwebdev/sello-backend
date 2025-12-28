// Enhanced input sanitization middleware
import DOMPurify from "isomorphic-dompurify";
import { body, validationResult } from "express-validator";

// XSS protection configuration
const sanitizeConfig = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ol",
    "ul",
    "li",
    "a",
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id"],
  ALLOW_DATA_ATTR: false,
};

// Enhanced sanitization function
export const sanitizeInput = (excludeFields = []) => {
  return (req, res, next) => {
    const sanitizeObject = (obj, path = "") => {
      if (typeof obj === "string") {
        return DOMPurify.sanitize(obj, sanitizeConfig);
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) =>
          sanitizeObject(item, `${path}[${index}]`)
        );
      }

      if (obj && typeof obj === "object") {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          const fieldPath = path ? `${path}.${key}` : key;

          // Skip sanitization for excluded fields
          if (
            excludeFields.includes(key) ||
            excludeFields.includes(fieldPath)
          ) {
            sanitized[key] = value;
          } else if (key === "password" || key === "token" || key === "otp") {
            // Never sanitize sensitive fields but log access
            sanitized[key] = value;
          } else {
            sanitized[key] = sanitizeObject(value, fieldPath);
          }
        }
        return sanitized;
      }

      return obj;
    };

    try {
      // Sanitize request body
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params) {
        req.params = sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      console.error("Sanitization error:", error);
      next(error);
    }
  };
};

// Input validation rules for common fields
export const commonValidations = {
  email: body("email").isEmail().normalizeEmail(),
  password: body("password")
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  name: body("name")
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name must contain only letters and spaces"),
  phone: body("phone")
    .optional()
    .isMobilePhone("any")
    .withMessage("Invalid phone number format"),
  url: body("url")
    .optional()
    .isURL({ protocols: ["http", "https"] })
    .withMessage("Invalid URL format"),
  price: body("price")
    .isFloat({ min: 0, max: 10000000 })
    .withMessage("Price must be a positive number"),
  year: body("year")
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage("Invalid year"),
};

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};

// Rate limiting for sensitive endpoints
export const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};
