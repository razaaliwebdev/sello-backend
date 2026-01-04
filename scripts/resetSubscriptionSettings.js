#!/usr/bin/env node

/**
 * Reset Subscription Settings Script
 * Resets all subscription-related settings to default values
 * Use this when settings get corrupted or need to be reset
 */

import mongoose from "mongoose";
import Settings from "../models/settingsModel.js";
import Logger from "../utils/logger.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DEFAULT_SUBSCRIPTION_SETTINGS = [
  {
    key: "paymentSystemEnabled",
    value: true,
    type: "boolean",
    category: "payment",
    description: "Payment system master switch",
  },
  {
    key: "showSubscriptionPlans",
    value: true,
    type: "boolean",
    category: "payment",
    description: "Show subscription plans to users",
  },
  {
    key: "showSubscriptionTab",
    value: true,
    type: "boolean",
    category: "payment",
    description: "Show subscription tab in dashboard",
  },
  {
    key: "showPaymentHistory",
    value: true,
    type: "boolean",
    category: "payment",
    description: "Show payment history to users",
  },
  {
    key: "enableAutoRenewal",
    value: true,
    type: "boolean",
    category: "payment",
    description: "Enable automatic subscription renewal",
  },
  {
    key: "requirePaymentApproval",
    value: false,
    type: "boolean",
    category: "payment",
    description: "Require manual approval for payments",
  },
];

async function resetSubscriptionSettings() {
  try {
    // Connect to database
    const mongoUri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sello-db";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database");

    // Delete existing subscription settings
    const subscriptionKeys = DEFAULT_SUBSCRIPTION_SETTINGS.map((s) => s.key);
    const deleteResult = await Settings.deleteMany({
      key: { $in: subscriptionKeys },
    });

    console.log(
      `🗑️  Deleted ${deleteResult.deletedCount} existing subscription settings`
    );

    // Insert default settings
    const insertResult = await Settings.insertMany(
      DEFAULT_SUBSCRIPTION_SETTINGS
    );

    console.log(
      `✅ Created ${insertResult.length} default subscription settings`
    );

    // Display current settings
    console.log("\n📋 Current Subscription Settings:");
    for (const setting of insertResult) {
      console.log(`   ${setting.key}: ${setting.value} (${setting.category})`);
    }

    console.log("\n🎉 Subscription settings reset successfully!");
    console.log(
      "💡 Admin can now configure these settings from the admin panel"
    );
  } catch (error) {
    console.error("❌ Error resetting subscription settings:", error);
    Logger.error("Reset Subscription Settings Error", error);
  } finally {
    await mongoose.disconnect();
    console.log("📡 Disconnected from database");
  }
}

// Run the reset
resetSubscriptionSettings();
