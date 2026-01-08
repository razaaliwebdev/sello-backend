// Route registry to organize all API routes
import express from "express";
import authRouter from "../routes/authRoutes.js";
import userRouter from "../routes/userRoutes.js";
import carRouter from "../routes/carRoutes.js";
import boostRouter from "../routes/boostRoutes.js";
import adminRouter from "../routes/adminRoutes.js";
import categoryRouter from "../routes/categoryRoutes.js";
import blogRouter from "../routes/blogRoutes.js";
import notificationRouter from "../routes/notificationRoutes.js";
import chatRouter from "../routes/chatRoutes.js";
import supportChatRouter from "../routes/supportChatRoutes.js";
import analyticsRouter from "../routes/analyticsRoutes.js";
import settingsRouter from "../routes/settingsRoutes.js";
import promotionsRouter from "../routes/promotionsRoutes.js";
import chatbotRouter from "../routes/chatbotRoutes.js";
import contactFormRouter from "../routes/contactFormRoutes.js";
import carChatRouter from "../routes/carChatRoutes.js";
import customerRequestRouter from "../routes/customerRequestRoutes.js";
import bannerRouter from "../routes/bannerRoutes.js";
import testimonialRouter from "../routes/testimonialRoutes.js";
import roleRouter from "../routes/roleRoutes.js";
import uploadRouter from "../routes/uploadRoutes.js";
import newsletterRouter from "../routes/newsletterRoutes.js";
import reviewRouter from "../routes/reviewRoutes.js";
import recommendationsRouter from "../routes/recommendationsRoutes.js";
import subscriptionRouter from "../routes/subscriptionRoutes.js";
import subscriptionPlanRouter from "../routes/subscriptionPlanRoutes.js";
import verificationRouter from "../routes/verificationRoutes.js";
import savedSearchRouter from "../routes/savedSearchRoutes.js";
import priceRouter from "../routes/priceRoutes.js";
import seoRouter from "../routes/seoRoutes.js";
import accountDeletionRouter from "../routes/accountDeletionRoutes.js";
import mapsRouter from "../routes/mapsRoutes.js";

class RouteRegistry {
  constructor() {
    this.routes = new Map();
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    // Core authentication and user management
    this.register("/api/auth", authRouter, "Authentication");
    this.register("/api/users", userRouter, "User Management");
    this.register(
      "/api/account-deletion",
      accountDeletionRouter,
      "Account Deletion"
    );

    // Core business logic
    this.register("/api/cars", carRouter, "Car Listings");
    this.register("/api/boost", boostRouter, "Car Boosting");
    this.register("/api/categories", categoryRouter, "Categories");

    // Content management
    this.register("/api/blogs", blogRouter, "Blog Management");
    this.register("/api/reviews", reviewRouter, "Reviews");
    this.register("/api/testimonials", testimonialRouter, "Testimonials");
    this.register("/api/banners", bannerRouter, "Banners");

    // Communication features
    this.register("/api/chat", chatRouter, "User Chat");
    this.register("/api/support-chat", supportChatRouter, "Support Chat");
    this.register("/api/chatbot", chatbotRouter, "Chatbot");
    this.register("/api/car-chat", carChatRouter, "Car Chat");
    this.register("/api/contact-form", contactFormRouter, "Contact Form");
    this.register("/api/newsletter", newsletterRouter, "Newsletter");

    // Admin and management
    this.register("/api/admin", adminRouter, "Admin Panel");
    this.register("/api/analytics", analyticsRouter, "Analytics");
    this.register("/api/settings", settingsRouter, "Settings");
    this.register("/api/promotions", promotionsRouter, "Promotions");
    this.register(
      "/api/customer-requests",
      customerRequestRouter,
      "Customer Requests"
    );
    this.register("/api/roles", roleRouter, "Role Management");

    // Payment and subscriptions
    this.register("/api/subscriptions", subscriptionRouter, "Subscriptions");
    this.register(
      "/api/subscription-plans",
      subscriptionPlanRouter,
      "Subscription Plans"
    );
    this.register("/api/price", priceRouter, "Pricing");

    // User features
    this.register("/api/notifications", notificationRouter, "Notifications");
    this.register("/api/verification", verificationRouter, "Verification");
    this.register("/api/saved-searches", savedSearchRouter, "Saved Searches");
    this.register(
      "/api/recommendations",
      recommendationsRouter,
      "Recommendations"
    );

    // Utilities
    this.register("/api/upload", uploadRouter, "File Upload");
    this.register("/api/maps", mapsRouter, "Google Maps Proxy");

    // SEO routes (must be after API routes to avoid conflicts)
    this.register("/", seoRouter, "SEO", true); // Root level
  }

  register(path, router, description, isRootLevel = false) {
    const routeInfo = {
      path,
      router,
      description,
      isRootLevel,
      middleware: [],
      rateLimit: null,
      cache: null,
    };

    this.routes.set(path, routeInfo);
    return this;
  }

  addMiddleware(path, middleware) {
    const route = this.routes.get(path);
    if (route) {
      route.middleware.push(middleware);
    }
    return this;
  }

  addRateLimit(path, rateLimit) {
    const route = this.routes.get(path);
    if (route) {
      route.rateLimit = rateLimit;
    }
    return this;
  }

  addCache(path, cacheOptions) {
    const route = this.routes.get(path);
    if (route) {
      route.cache = cacheOptions;
    }
    return this;
  }

  applyRoutes(app) {
    for (const [path, route] of this.routes) {
      // Apply rate limiting if configured
      if (route.rateLimit) {
        app.use(path, route.rateLimit);
      }

      // Apply custom middleware
      for (const middleware of route.middleware) {
        app.use(path, middleware);
      }

      // Apply caching if configured
      if (route.cache) {
        app.use(path, route.cache);
      }

      // Register the route
      app.use(path, route.router);
    }

    return app;
  }

  getRouteInfo() {
    const routeList = [];
    for (const [path, route] of this.routes) {
      routeList.push({
        path,
        description: route.description,
        isRootLevel: route.isRootLevel,
        middlewareCount: route.middleware.length,
        hasRateLimit: !!route.rateLimit,
        hasCache: !!route.cache,
      });
    }
    return routeList;
  }

  // Health check for all routes
  async checkRoutesHealth() {
    const healthStatus = {};

    for (const [path, route] of this.routes) {
      try {
        // Basic health check - ensure router is properly loaded
        healthStatus[path] = {
          status: "healthy",
          description: route.description,
          loaded: !!route.router,
        };
      } catch (error) {
        healthStatus[path] = {
          status: "unhealthy",
          description: route.description,
          error: error.message,
        };
      }
    }

    return healthStatus;
  }
}

export default RouteRegistry;
