import cookieParser from "cookie-parser";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import mongoose from "mongoose";

import Logger from "./utils/logger.js";
import { performanceMonitor } from "./middlewares/performanceMiddleware.js";
import { checkMaintenanceMode } from "./middlewares/maintenanceModeMiddleware.js";

import {
  notFoundHandler,
  errorHandler,
  validationErrorHandler,
  duplicateKeyErrorHandler,
  castErrorHandler,
} from "./middlewares/errorHandler.js";

dotenv.config();

export const app = express();

/* -------------------------------------------------------------------------- */
/*                               SECURITY (HELMET)                             */
/* -------------------------------------------------------------------------- */
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Google OAuth
    crossOriginEmbedderPolicy: { policy: "unsafe-none" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
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

/* -------------------------------------------------------------------------- */
/*                                COMPRESSION                                  */
/* -------------------------------------------------------------------------- */
app.use(compression());

/* -------------------------------------------------------------------------- */
/*                                   CORS 🔥                                   */
/* -------------------------------------------------------------------------- */

const allowedOrigins = [
  "https://sello.pk",
  "https://www.sello.pk",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  // Add mobile development ports
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server, OAuth redirects, Postman
      if (!origin) return callback(null, true);

      // Allow all localhost origins in development
      if (
        process.env.NODE_ENV !== "production" &&
        (origin.includes("localhost") || origin.includes("127.0.0.1"))
      ) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      Logger.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200,
  })
);

// Explicitly handle preflight (important for OAuth)
app.options("*", cors());

/* -------------------------------------------------------------------------- */
/*                                BODY PARSERS                                 */
/* -------------------------------------------------------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

/* -------------------------------------------------------------------------- */
/*                                 MIDDLEWARES                                 */
/* -------------------------------------------------------------------------- */
import requestIdMiddleware from "./middlewares/requestIdMiddleware.js";
app.use(requestIdMiddleware);

app.use(performanceMonitor);

import { requestTimeout } from "./middlewares/requestTimeout.js";
app.use(requestTimeout(60000)); // Increased from 30s to 60s

import { sanitizeInput } from "./middlewares/sanitizeMiddleware.js";
import { rateLimit } from "./middlewares/securityMiddleware.js";

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

app.use(rateLimit);

/* -------------------------------------------------------------------------- */
/*                        AUTO TOKEN REFRESH MIDDLEWARE                          */
/* -------------------------------------------------------------------------- */
import autoRefreshToken from "./utils/tokenRefreshMiddleware.js";
app.use(autoRefreshToken);

/* -------------------------------------------------------------------------- */
/*                           MAINTENANCE MODE                                  */
/* -------------------------------------------------------------------------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/admin")) return next();
  return checkMaintenanceMode(req, res, next);
});

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                    */
/* -------------------------------------------------------------------------- */
import RouteRegistry from "./utils/routeRegistry.js";
const routeRegistry = new RouteRegistry();
routeRegistry.applyRoutes(app);

/* -------------------------------------------------------------------------- */
/*                               HEALTH CHECKS                                 */
/* -------------------------------------------------------------------------- */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SELLO API is running",
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

app.get("/health", (req, res) => {
  const healthy = mongoose.connection.readyState === 1;
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "healthy" : "unhealthy",
    database: {
      connected: healthy,
      state: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    server: {
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: {
        used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      nodeVersion: process.version,
      platform: process.platform,
    },
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/*                               ERROR HANDLING                                */
/* -------------------------------------------------------------------------- */
app.use(notFoundHandler);
app.use(validationErrorHandler);
app.use(duplicateKeyErrorHandler);
app.use(castErrorHandler);
app.use(errorHandler);
