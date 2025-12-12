import cookieParser from 'cookie-parser';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js';
import boostRouter from './routes/boostRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import categoryRouter from './routes/categoryRoutes.js';
import blogRouter from './routes/blogRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import supportChatRouter from './routes/supportChatRoutes.js';
import analyticsRouter from './routes/analyticsRoutes.js';
import settingsRouter from './routes/settingsRoutes.js';
import promotionsRouter from './routes/promotionsRoutes.js';
import chatbotRouter from './routes/chatbotRoutes.js';
import contactFormRouter from './routes/contactFormRoutes.js';
import carChatRouter from './routes/carChatRoutes.js';
import customerRequestRouter from './routes/customerRequestRoutes.js';
import bannerRouter from './routes/bannerRoutes.js';
import testimonialRouter from './routes/testimonialRoutes.js';
import roleRouter from './routes/roleRoutes.js';
import uploadRouter from './routes/uploadRoutes.js';
import newsletterRouter from './routes/newsletterRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import recommendationsRouter from './routes/recommendationsRoutes.js';
import subscriptionRouter from './routes/subscriptionRoutes.js';
import subscriptionPlanRouter from './routes/subscriptionPlanRoutes.js';
import { performanceMonitor } from './middlewares/performanceMiddleware.js';
import Logger from './utils/logger.js';
import mongoose from 'mongoose';
import {
  notFoundHandler,
  errorHandler,
  validationErrorHandler,
  duplicateKeyErrorHandler,
  castErrorHandler
} from './middlewares/errorHandler.js';

dotenv.config();

export const app = express();

// MIDDLEWARES
// Security headers (Helmet) - configure for Google OAuth compatibility
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Required for Google OAuth
  crossOriginEmbedderPolicy: { policy: "unsafe-none" }, // Required for Google OAuth
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"], // Allow images from any source (for Cloudinary, etc.)
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://www.googleapis.com"],
    },
  },
}));

// Compression middleware (gzip)
app.use(compression());

// CORS configuration - supports multiple origins from environment variable
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4000", "http://localhost:5174"];

// Add production URL if provided
if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      Logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "email", "X-Requested-With"],
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

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
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring
app.use(performanceMonitor);

// Security: Input sanitization middleware
import { sanitizeInput } from './middlewares/sanitizeMiddleware.js';
import { rateLimit, validateFileUpload } from './middlewares/securityMiddleware.js';
// Exclude fields that should not be sanitized (passwords, tokens, HTML content from editors)
app.use(sanitizeInput(['password', 'token', 'otp', 'content', 'description', 'message', 'geoLocation']));

// Rate limiting (use Redis in production for distributed systems)
if (process.env.NODE_ENV === 'production') {
  app.use(rateLimit);
}

// ROUTES
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/cars", carRouter);
app.use("/api/boost", boostRouter);
app.use("/api/admin", adminRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/blogs", blogRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/chat", chatRouter);
app.use("/api/support-chat", supportChatRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/promotions", promotionsRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/contact-form", contactFormRouter);
app.use("/api/car-chat", carChatRouter);
app.use("/api/customer-requests", customerRequestRouter);
app.use("/api/banners", bannerRouter);
app.use("/api/testimonials", testimonialRouter);
app.use("/api/roles", roleRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/subscriptions", subscriptionRouter);
app.use("/api/subscription-plans", subscriptionPlanRouter);

// Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SELLO API is running",
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(validationErrorHandler);
app.use(duplicateKeyErrorHandler);
app.use(castErrorHandler);
app.use(errorHandler);

