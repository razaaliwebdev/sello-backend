import cookieParser from "cookie-parser";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import carRouter from "./routes/carRoutes.js";
import boostRouter from "./routes/boostRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import categoryRouter from "./routes/categoryRoutes.js";
import blogRouter from "./routes/blogRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import chatRouter from "./routes/chatRoutes.js";
import supportChatRouter from "./routes/supportChatRoutes.js";
import analyticsRouter from "./routes/analyticsRoutes.js";
import settingsRouter from "./routes/settingsRoutes.js";
import promotionsRouter from "./routes/promotionsRoutes.js";
import chatbotRouter from "./routes/chatbotRoutes.js";
import contactFormRouter from "./routes/contactFormRoutes.js";
import carChatRouter from "./routes/carChatRoutes.js";
import customerRequestRouter from "./routes/customerRequestRoutes.js";
import bannerRouter from "./routes/bannerRoutes.js";
import testimonialRouter from "./routes/testimonialRoutes.js";
import roleRouter from "./routes/roleRoutes.js";
import uploadRouter from "./routes/uploadRoutes.js";
import newsletterRouter from "./routes/newsletterRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import recommendationsRouter from "./routes/recommendationsRoutes.js";
import subscriptionRouter from "./routes/subscriptionRoutes.js";
import subscriptionPlanRouter from "./routes/subscriptionPlanRoutes.js";
import verificationRouter from "./routes/verificationRoutes.js";
import savedSearchRouter from "./routes/savedSearchRoutes.js";
import priceRouter from "./routes/priceRoutes.js";
import seoRouter from "./routes/seoRoutes.js";
import { performanceMonitor } from "./middlewares/performanceMiddleware.js";
import { checkMaintenanceMode } from "./middlewares/maintenanceModeMiddleware.js";
import Logger from "./utils/logger.js";
import mongoose from "mongoose";
import {
  notFoundHandler,
  errorHandler,
  validationErrorHandler,
  duplicateKeyErrorHandler,
  castErrorHandler,
} from "./middlewares/errorHandler.js";

dotenv.config();

export const app = express();

// MIDDLEWARES
// Security headers (Helmet) - configure for Google OAuth compatibility
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Required for Google OAuth
    crossOriginEmbedderPolicy: { policy: "unsafe-none" }, // Required for Google OAuth
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"], // Allow images from any source (for Cloudinary, etc.)
        scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://www.googleapis.com",
        ],
      },
    },
  })
);

// Compression middleware (gzip)
app.use(compression());

// CORS configuration - supports multiple origins from environment variable
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
  : process.env.NODE_ENV === "production"
  ? [] // Production: require CLIENT_URL to be set
  : ["http://localhost:5173", "http://127.0.0.1:5173"]; // Restricted development origins

// Add production URL if provided
if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

// Add FRONTEND_URL if different from CLIENT_URL
if (
  process.env.FRONTEND_URL &&
  !allowedOrigins.includes(process.env.FRONTEND_URL)
) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// In production, if no CLIENT_URL is set, allow the production frontend URL
if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  allowedOrigins.push("https://sello.pk");
}

// Validate origins function
const isValidOrigin = (origin) => {
  if (!origin) return false; // Require origin for security

  // Check against allowed origins
  if (allowedOrigins.includes(origin)) return true;

  // In development, be more permissive but still validate
  if (process.env.NODE_ENV === "development") {
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
    return localhostPattern.test(origin);
  }

  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Reject requests with no origin (except for server-to-server)
      if (!origin) {
        return callback(new Error("Origin required for security"));
      }

      if (isValidOrigin(origin)) {
        callback(null, true);
      } else {
        Logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "email",
      "X-Requested-With",
    ],
    credentials: true,
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200,
    maxAge: 86400, // Cache preflight requests for 24 hours
  })
);

// Add security headers for Google OAuth
// Note: COOP "unsafe-none" is needed for Google OAuth to work properly
app.use((req, res, next) => {
  // Allow cross-origin communication for OAuth flows
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

// Stripe webhook needs raw body, so we need to handle it before json parser
// But we'll handle it in the route itself with express.raw()
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request ID tracking - add early for logging
import requestIdMiddleware from "./middlewares/requestIdMiddleware.js";
app.use(requestIdMiddleware);

// Performance monitoring
app.use(performanceMonitor);

// Request timeout middleware (30 seconds default)
import { requestTimeout } from "./middlewares/requestTimeout.js";
app.use(requestTimeout(30000)); // 30 seconds timeout

// Security: Input sanitization middleware
import { sanitizeInput } from "./middlewares/sanitizeMiddleware.js";
import {
  rateLimit,
  validateFileUpload,
} from "./middlewares/securityMiddleware.js";
// Exclude fields that should not be sanitized (passwords, tokens, HTML content from editors)
app.use(
  sanitizeInput([
    "password",
    "token",
    "otp",
    "content",
    "description",
    "message",
    "geoLocation",
  ])
);

// Rate limiting (uses Redis when available for distributed systems)
// Apply rate limiting in all environments
// Development: More lenient (500 req/15min), Production: Stricter (100 req/15min)
// Now uses express-rate-limit with Redis store support
app.use(rateLimit);

// Maintenance mode check - apply to all routes except admin routes
// Admin routes will be handled separately to allow admins to manage settings
app.use((req, res, next) => {
  // Skip maintenance mode check for admin routes
  if (req.path.startsWith("/api/admin")) {
    return next();
  }
  // Apply maintenance mode check to all other routes
  return checkMaintenanceMode(req, res, next);
});

// ROUTES - Organized using RouteRegistry
import RouteRegistry from "./utils/routeRegistry.js";

const routeRegistry = new RouteRegistry();

// Apply all registered routes with their middleware
routeRegistry.applyRoutes(app);

// Swagger API Documentation
if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_SWAGGER === "true"
) {
  try {
    const swaggerConfig = await import("./config/swagger.js");
    const { initializeSwagger, getSwaggerSpec, swaggerUi } = swaggerConfig;

    // Initialize swagger packages
    await initializeSwagger();

    const swaggerSpec = getSwaggerSpec();
    if (swaggerSpec && swaggerUi) {
      app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
          customCss: ".swagger-ui .topbar { display: none }",
          customSiteTitle: "Sello API Documentation",
        })
      );
      Logger.info("Swagger documentation available at /api-docs");
    } else {
      Logger.warn(
        "Swagger packages not installed. Install with: npm install swagger-jsdoc swagger-ui-express"
      );
    }
  } catch (error) {
    Logger.warn("Swagger not configured", { error: error.message });
  }
}

// Health check route - enhanced with detailed status
app.get("/", async (req, res) => {
  const health = {
    success: true,
    message: "SELLO API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: {
        status:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name || "unknown",
      },
      redis: {
        status: "unknown",
      },
    },
  };

  // Check Redis if available
  try {
    const redis = await import("./utils/redis.js");
    health.services.redis.status = redis.default.isAvailable()
      ? "connected"
      : "disconnected";
  } catch (error) {
    health.services.redis.status = "not configured";
  }

  // Set cache headers
  res.set("Cache-Control", "no-cache");

  const statusCode =
    health.services.database.status === "connected" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Detailed health check endpoint
app.get("/health", async (req, res) => {
  const health = {
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    services: {
      database: {
        status: mongoose.connection.readyState === 1 ? "healthy" : "unhealthy",
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name || "unknown",
        host: mongoose.connection.host || "unknown",
      },
      redis: {
        status: "unknown",
      },
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
    },
  };

  // Check Redis if available
  try {
    const redis = await import("./utils/redis.js");
    health.services.redis.status = redis.default.isAvailable()
      ? "healthy"
      : "unhealthy";
  } catch (error) {
    health.services.redis.status = "not configured";
  }

  // Determine overall health
  const isHealthy = health.services.database.status === "healthy";
  const statusCode = isHealthy ? 200 : 503;

  res.set("Cache-Control", "no-cache");
  res.status(statusCode).json(health);
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(validationErrorHandler);
app.use(duplicateKeyErrorHandler);
app.use(castErrorHandler);
app.use(errorHandler);
