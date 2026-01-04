#!/usr/bin/env node

/**
 * Production Environment Checker
 * Diagnoses common production issues
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔍 SELLO Production Environment Checker");
console.log("=====================================\n");

// Check environment variables
function checkEnvironmentVariables() {
  console.log("📋 Checking Environment Variables...");

  const criticalVars = ["NODE_ENV", "JWT_SECRET", "MONGO_URI", "CLIENT_URL"];

  const emailVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_MAIL", "SMTP_PASSWORD"];

  let criticalIssues = [];
  let emailIssues = [];

  // Check critical variables
  criticalVars.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      criticalIssues.push(`❌ ${varName} is missing`);
    } else {
      if (varName === "NODE_ENV" && value !== "production") {
        criticalIssues.push(
          `⚠️  NODE_ENV is "${value}" (should be "production")`
        );
      } else if (varName === "JWT_SECRET" && value.length < 32) {
        criticalIssues.push(
          `⚠️  JWT_SECRET is too short (${value.length} chars, min 32 recommended)`
        );
      } else {
        console.log(`✅ ${varName} is set`);
      }
    }
  });

  // Check email variables
  emailVars.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      emailIssues.push(`❌ ${varName} is missing`);
    } else {
      console.log(`✅ ${varName} is set`);
    }
  });

  if (criticalIssues.length > 0) {
    console.log("\n🚨 Critical Issues:");
    criticalIssues.forEach((issue) => console.log(`   ${issue}`));
  }

  if (emailIssues.length > 0) {
    console.log("\n📧 Email Issues:");
    emailIssues.forEach((issue) => console.log(`   ${issue}`));
  }

  return { criticalIssues, emailIssues };
}

// Check database connection
async function checkDatabaseConnection() {
  console.log("\n🗄️  Checking Database Connection...");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log("❌ MONGO_URI not set");
    return false;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });

    // Test database operations
    await mongoose.connection.db.admin().ping();

    console.log("✅ Database connected successfully");
    console.log(`✅ Database: ${mongoose.connection.name}`);
    console.log(`✅ Host: ${mongoose.connection.host}`);

    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.log("❌ Database connection failed");
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Check email configuration
async function checkEmailConfiguration() {
  console.log("\n📧 Checking Email Configuration...");

  const requiredVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_MAIL", "SMTP_PASSWORD"];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.log("❌ Email configuration incomplete");
    missing.forEach((varName) => console.log(`   Missing: ${varName}`));
    return false;
  }

  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();
    console.log("✅ SMTP connection verified");
    console.log(`✅ Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    console.log(`✅ Email: ${process.env.SMTP_MAIL}`);

    return true;
  } catch (error) {
    console.log("❌ SMTP connection failed");
    console.log(`   Error: ${error.message}`);

    if (error.code === "EAUTH") {
      console.log("   💡 Check SMTP credentials (username/password)");
    } else if (error.code === "ECONNECTION") {
      console.log("   💡 Check SMTP host and port");
    } else if (error.code === "ETIMEDOUT") {
      console.log("   💡 Check network connectivity and firewall");
    }

    return false;
  }
}

// Check file permissions
function checkFilePermissions() {
  console.log("\n📁 Checking File Permissions...");

  const criticalFiles = [".env", "server.js", "package.json"];

  const issues = [];

  criticalFiles.forEach((file) => {
    const filePath = path.join(__dirname, "..", file);
    if (fs.existsSync(filePath)) {
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
        console.log(`✅ ${file} is readable`);
      } catch (error) {
        issues.push(`❌ ${file} is not readable`);
      }
    } else {
      issues.push(`❌ ${file} not found`);
    }
  });

  // Check log directory
  const logDir = path.join(__dirname, "..", "..", "logs");
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      console.log("✅ Created logs directory");
    } catch (error) {
      issues.push(`❌ Cannot create logs directory: ${error.message}`);
    }
  } else {
    console.log("✅ Logs directory exists");
  }

  return issues;
}

// Check system resources
function checkSystemResources() {
  console.log("\n💻 Checking System Resources...");

  try {
    // Memory usage
    const memUsage = process.memoryUsage();
    console.log(
      `✅ Memory Usage: ${Math.round(
        memUsage.heapUsed / 1024 / 1024
      )}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    );

    // Uptime
    const uptime = process.uptime();
    console.log(`✅ Process Uptime: ${Math.floor(uptime / 60)} minutes`);

    // Node version
    console.log(`✅ Node.js Version: ${process.version}`);

    // Platform
    console.log(`✅ Platform: ${process.platform}`);

    return true;
  } catch (error) {
    console.log("❌ Error checking system resources");
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Main check function
async function runProductionCheck() {
  const startTime = Date.now();

  try {
    // Run all checks
    const envCheck = checkEnvironmentVariables();
    const dbCheck = await checkDatabaseConnection();
    const emailCheck = await checkEmailConfiguration();
    const fileCheck = checkFilePermissions();
    const resourceCheck = checkSystemResources();

    // Summary
    console.log("\n📊 SUMMARY");
    console.log("===========");

    const hasCriticalIssues = envCheck.criticalIssues.length > 0;
    const hasEmailIssues = envCheck.emailIssues.length > 0;
    const hasDbIssues = !dbCheck;
    const hasFileIssues = fileCheck.length > 0;

    if (hasCriticalIssues || hasDbIssues || hasFileIssues) {
      console.log(
        "🚨 CRITICAL ISSUES FOUND - Fix before deploying to production"
      );
    } else if (hasEmailIssues || !emailCheck) {
      console.log("⚠️  WARNINGS FOUND - Email functionality may not work");
    } else {
      console.log("✅ All checks passed - Ready for production!");
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS");
    console.log("==================");

    if (hasCriticalIssues) {
      console.log("1. Fix all critical environment variables");
      console.log("2. Ensure database is accessible");
      console.log("3. Check file permissions");
    }

    if (hasEmailIssues) {
      console.log("4. Configure SMTP settings for email functionality");
    }

    if (!emailCheck) {
      console.log("5. Test SMTP connection with correct credentials");
    }

    console.log("6. Set up monitoring and logging");
    console.log("7. Configure HTTPS and security headers");
    console.log("8. Set up process manager (PM2)");

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Check completed in ${duration}ms`);

    // Exit with appropriate code
    if (hasCriticalIssues || hasDbIssues || hasFileIssues) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.log("\n❌ Unexpected error during check");
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionCheck();
}

export { runProductionCheck };
