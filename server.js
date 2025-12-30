import http from "http";
import { app } from "./app.js";
import connectDB from "./config/db.js";
import { initializeSocket } from "./socket/socketServer.js";
import { initializeRoles } from "./controllers/roleController.js";
import Logger from "./utils/logger.js";
import mongoose from "mongoose";
import validateEnvVars from "./utils/envValidator.js";

// Initialize Sentry early if configured
if (process.env.SENTRY_DSN) {
  import("@sentry/node")
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment:
          process.env.SENTRY_ENVIRONMENT ||
          process.env.NODE_ENV ||
          "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      });
      Logger.info("Sentry initialized for error tracking");
    })
    .catch(() => {
      Logger.warn(
        "Sentry SDK not installed. Install with: npm install @sentry/node"
      );
    });
}

// Validate environment variables before starting server
validateEnvVars({ strict: process.env.NODE_ENV === "production" });

// Optional: Setup cron jobs for background tasks
let cronJobs = null;
if (process.env.ENABLE_CRON_JOBS === "true") {
  try {
    const cron = await import("node-cron");

    // Run boost expiration every 30 minutes
    cron.default.schedule("*/30 * * * *", async () => {
      Logger.info("Running boost expiration job...");
      try {
        const { default: runBoostExpiration } = await import(
          "./scripts/boostExpirationJob.js"
        );
        // Note: The script handles its own DB connection
      } catch (error) {
        Logger.error("Boost expiration cron job failed", error);
      }
    });

    // Run subscription expiration daily at midnight
    cron.default.schedule("0 0 * * *", async () => {
      Logger.info("Running subscription expiration job...");
      try {
        const { default: runSubscriptionExpiration } = await import(
          "./scripts/subscriptionExpirationJob.js"
        );
        // Note: The script handles its own DB connection
      } catch (error) {
        Logger.error("Subscription expiration cron job failed", error);
      }
    });

    // Run saved search alerts every hour
    cron.default.schedule("0 * * * *", async () => {
      Logger.info("Running saved search alerts job...");
      try {
        const { sendSavedSearchAlerts } = await import(
          "./controllers/savedSearchController.js"
        );
        await sendSavedSearchAlerts();
      } catch (error) {
        Logger.error("Saved search alerts cron job failed", error);
      }
    });

    // Run listing expiry job daily at 2 AM
    cron.default.schedule("0 2 * * *", async () => {
      Logger.info("Running listing expiry job...");
      try {
        // Import and run the expiry script
        const { runExpireListings } = await import(
          "./scripts/expireOldListings.js"
        );
        // Note: The script handles its own DB connection and closes it
        await runExpireListings();
      } catch (error) {
        Logger.error("Listing expiry cron job failed", error);
      }
    });

    // Run refresh token cleanup daily at 3 AM
    // Cleans up expired tokens (backup to TTL index) and revoked tokens older than 30 days
    cron.default.schedule("0 3 * * *", async () => {
      Logger.info("Running refresh token cleanup job...");
      try {
        const RefreshToken = (await import("./models/refreshTokenModel.js"))
          .default;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Delete expired tokens (backup cleanup - TTL index should handle this, but ensure cleanup)
        const expiredResult = await RefreshToken.deleteMany({
          expiresAt: { $lt: new Date() },
        });

        // Delete revoked tokens older than 30 days
        const revokedResult = await RefreshToken.deleteMany({
          isRevoked: true,
          revokedAt: { $lt: thirtyDaysAgo },
        });

        Logger.info("Refresh token cleanup completed", {
          expiredTokensDeleted: expiredResult.deletedCount,
          revokedTokensDeleted: revokedResult.deletedCount,
          totalDeleted: expiredResult.deletedCount + revokedResult.deletedCount,
        });
      } catch (error) {
        Logger.error("Refresh token cleanup cron job failed", error);
      }
    });

    Logger.info("Cron jobs initialized");
  } catch (error) {
    Logger.warn(
      "node-cron not installed. Background jobs disabled. Install with: npm install node-cron",
      { error: error.message }
    );
  }
}

// Start server regardless of DB connection status
const startServer = () => {
  try {
    const PORT = process.env.PORT || 4000;
    const server = http.createServer(app);

    // Initialize Socket.io with error handling
    let io;
    try {
      io = initializeSocket(server);
      app.set("io", io);
    } catch (socketError) {
      Logger.error("Socket.io initialization error", socketError);
      // Continue without socket.io if it fails
    }

    server.listen(PORT, () => {
      Logger.info(`Server is running on PORT:${PORT}`);
      Logger.info(`API available at http://localhost:${PORT}/api`);
      // Startup messages - intentional console.log for visibility
      console.log(`🚀 Server is running on PORT:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      if (io) {
        Logger.info("Socket.io initialized");
        console.log(`🔌 Socket.io initialized`);
      }
    });

    // Handle server errors
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        Logger.error(`Port ${PORT} is already in use`, error);
        // Intentional console.error for startup errors - user needs to see this
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`\n💡 To fix this, please do one of the following:`);
        console.error(`   1. Kill the process using port ${PORT}:`);
        console.error(`      Windows: taskkill /F /PID <PID>`);
        console.error(`      Or find PID: netstat -ano | findstr :${PORT}`);
        console.error(
          `   2. Use a different port by setting PORT environment variable`
        );
        console.error(`      Example: PORT=3001 npm run dev\n`);
        process.exit(1);
      } else {
        Logger.error("Server error", error);
        console.error("❌ Server error:", error);
      }
    });
  } catch (error) {
    Logger.error("Failed to start server", error);
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Try to connect to DB, but start server anyway
connectDB()
  .then(() => {
    // Initialize default roles only if DB is connected
    if (mongoose.connection.readyState === 1) {
      try {
        initializeRoles();
      } catch (roleError) {
        Logger.error("Role initialization error", roleError);
        console.error("Role initialization error:", roleError);
      }
    }
    startServer();
  })
  .catch((error) => {
    Logger.error("DB connection error (server will start anyway)", error);
    console.error(
      "DB connection error (server will start anyway):",
      error.message
    );
    // Start server even if DB connection fails
    startServer();
  });
