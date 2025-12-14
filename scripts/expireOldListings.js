/**
 * Daily script to mark old active listings as expired.
 *
 * Behaviour:
 * - Find all cars where:
 *     status = 'active'
 *     expiryDate < now (and expiryDate is not null)
 * - Mark them as status = 'expired'
 *
 * Usage (example cron - run daily at 2 AM):
 *   node server/scripts/expireOldListings.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "../models/carModel.js";
import Logger from "../utils/logger.js";

dotenv.config();

const runExpireListings = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not set in environment variables.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for expiry job");

    const now = new Date();

    // Find active listings past their expiry date
    const listingsToExpire = await Car.find({
      status: "active",
      expiryDate: { $lt: now, $ne: null }, // Expired and expiryDate is set
    }).lean();

    if (!listingsToExpire.length) {
      console.log("ℹ️ No listings eligible for expiry.");
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`🕐 Found ${listingsToExpire.length} listings to mark as expired`);

    // Mark as expired
    const result = await Car.updateMany(
      {
        status: "active",
        expiryDate: { $lt: now, $ne: null },
      },
      {
        $set: {
          status: "expired",
        },
      }
    );

    Logger.info("Listings expired", {
      count: result.modifiedCount,
      timestamp: now,
    });

    console.log(`✅ Marked ${result.modifiedCount} listings as expired`);
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    Logger.error("Error running expiry script", error);
    console.error("❌ Error running expiry script:", error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('expireOldListings.js')) {
    runExpireListings();
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
    runExpireListings();
}
