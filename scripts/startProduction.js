#!/usr/bin/env node

/**
 * Production Startup Script
 * Performs pre-startup checks and starts the server
 */

import { runProductionCheck } from "./checkProduction.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

console.log("🚀 SELLO Production Startup");
console.log("============================\n");

// Check if running in production mode
if (process.env.NODE_ENV !== "production") {
  console.log('⚠️  WARNING: NODE_ENV is not set to "production"');
  console.log(
    "   Consider setting NODE_ENV=production for production deployment\n"
  );
}

// Run production checks
async function startProductionServer() {
  try {
    console.log("🔍 Running pre-startup checks...\n");

    // Run the production check
    await runProductionCheck();

    console.log("\n✅ All checks passed! Starting server...\n");

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log("📁 Created logs directory");
    }

    // Start the server
    const serverProcess = spawn("node", ["server.js"], {
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env },
      cwd: process.cwd(),
    });

    // Handle server output
    serverProcess.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`[SERVER] ${output}`);

        // Also write to log file
        const logFile = path.join(logsDir, "server.log");
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${output}\n`);
      }
    });

    serverProcess.stderr.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(`[ERROR] ${output}`);

        // Also write to error log file
        const errorLogFile = path.join(logsDir, "error.log");
        fs.appendFileSync(
          errorLogFile,
          `[${new Date().toISOString()}] ERROR: ${output}\n`
        );
      }
    });

    // Handle server exit
    serverProcess.on("close", (code) => {
      if (code === 0) {
        console.log("\n✅ Server stopped gracefully");
      } else {
        console.error(`\n❌ Server exited with code ${code}`);
        process.exit(code);
      }
    });

    // Handle process signals
    process.on("SIGINT", () => {
      console.log("\n🛑 Received SIGINT, shutting down gracefully...");
      serverProcess.kill("SIGINT");
    });

    process.on("SIGTERM", () => {
      console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
      serverProcess.kill("SIGTERM");
    });

    // Wait for server to start
    setTimeout(() => {
      console.log("\n🎉 Server should be running now!");
      console.log("📊 Check the logs for any issues");
      console.log('🔍 Use "pm2 status" to check process status if using PM2');
    }, 3000);
  } catch (error) {
    console.error("\n❌ Failed to start production server");
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }
}

// Start the production server
startProductionServer();
