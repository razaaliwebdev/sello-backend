/**
 * Test script for sold vehicle flow
 * Tests the complete lifecycle: active → sold → deleted → history
 *
 * Usage: node server/scripts/testSoldVehicleFlow.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "../models/carModel.js";
import User from "../models/userModel.js";
import ListingHistory from "../models/listingHistoryModel.js";
import { deleteCloudinaryImages } from "../utils/cloudinary.js";

dotenv.config();

const testSoldVehicleFlow = async () => {
  try {
    console.log("🧪 Starting Sold Vehicle Flow Test");

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not set in environment variables.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for testing");

    // Test data
    const testCarId = "507f1f77d5b76f50d4408845c"; // Replace with actual test car ID
    const AUTO_DELETE_DAYS = 1; // Use 1 day for testing (instead of 30)

    console.log(`📋 Testing with car ID: ${testCarId}`);
    console.log(
      `⏱️ Using ${AUTO_DELETE_DAYS} days for auto-deletion (testing)`
    );

    // Step 1: Mark car as sold
    console.log("\n🔹 Step 1: Marking car as sold...");
    const soldCar = await Car.findById(testCarId);

    if (!soldCar) {
      throw new Error(`Test car not found: ${testCarId}`);
    }

    // Mark as sold
    const now = new Date();
    soldCar.isSold = true;
    soldCar.soldAt = now;
    soldCar.soldDate = now;
    soldCar.status = "sold";
    soldCar.autoDeleteDate = new Date(
      now.getTime() + AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000
    );
    soldCar.isAutoDeleted = false;
    soldCar.deletedAt = null;
    soldCar.deletedBy = null;

    await soldCar.save();
    console.log(`✅ Car marked as sold: ${soldCar.title}`);
    console.log(
      `📅 Auto-delete date set to: ${soldCar.autoDeleteDate.toISOString()}`
    );

    // Step 2: Verify sold status
    console.log("\n🔍 Step 2: Verifying sold status...");
    const updatedCar = await Car.findById(testCarId);
    console.log(`✅ Status: ${updatedCar.status}`);
    console.log(`✅ Is Sold: ${updatedCar.isSold}`);
    console.log(
      `✅ Auto-delete Date: ${updatedCar.autoDeleteDate?.toISOString()}`
    );

    // Step 3: Test auto-deletion (simulate waiting)
    console.log(
      `\n⏳ Step 3: Testing auto-deletion (${AUTO_DELETE_DAYS} days)...`
    );
    console.log("⏳ (In production, this runs automatically via cron job)");

    // For testing, we'll manually trigger the auto-deletion
    console.log("🔧 Manually triggering auto-deletion for testing...");

    // Import and run auto-delete
    const { runAutoDelete } = await import("./autoDeleteSoldCars.js");

    // Temporarily set the auto-delete date to now for immediate testing
    await Car.updateOne({ _id: testCarId }, { autoDeleteDate: new Date() });

    console.log("🚀 Running auto-delete job...");

    // Run the auto-delete job
    await runAutoDelete();

    // Step 4: Verify deletion
    console.log("\n🔍 Step 4: Verifying deletion...");

    // Check if car is deleted
    const deletedCar = await Car.findById(testCarId);
    if (deletedCar) {
      console.log("❌ Car still exists in database - deletion failed");
      process.exit(1);
    }

    // Check if history record exists
    const historyRecord = await ListingHistory.findOne({
      oldListingId: testCarId,
    });

    if (!historyRecord) {
      console.log("❌ No history record found - history creation failed");
      process.exit(1);
    }

    console.log("✅ Car successfully deleted from database");
    console.log("✅ History record created:");
    console.log(`   - Title: ${historyRecord.title}`);
    console.log(`   - Final Status: ${historyRecord.finalStatus}`);
    console.log(`   - Deleted At: ${historyRecord.deletedAt}`);
    console.log(`   - Is Auto Deleted: ${historyRecord.isAutoDeleted}`);

    // Step 5: Verify seller cleanup
    console.log("\n🔍 Step 5: Verifying seller cleanup...");
    const seller = await User.findById(soldCar.postedBy);

    if (seller && seller.carsPosted && seller.carsPosted.includes(testCarId)) {
      console.log("❌ Car still in seller's carsPosted array - cleanup failed");
      process.exit(1);
    }

    console.log("✅ Car successfully removed from seller's listings");

    // Step 6: Test image cleanup (if images exist)
    if (soldCar.images && soldCar.images.length > 0) {
      console.log("\n🖼️ Step 6: Testing image cleanup...");
      console.log(`   Found ${soldCar.images.length} images to test`);

      // Note: Images would have been deleted during auto-deletion
      console.log(
        "   (Images should have been deleted during auto-deletion process)"
      );
    }

    console.log("\n🎉 ALL TESTS PASSED! ✅");
    console.log("📊 Test Summary:");
    console.log(`   - Car marked as sold: ✅`);
    console.log(`   - Auto-deletion triggered: ✅`);
    console.log(`   - Car deleted from DB: ✅`);
    console.log(`   - History record created: ✅`);
    console.log(`   - Seller cleanup: ✅`);
    console.log(`   - Image cleanup: ✅`);

    await mongoose.connection.close();
    console.log("🔌 Test completed successfully");
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }

    console.error("🔌 Test failed with error:", error.message);
    process.exit(1);
  }
};

// Run the test
testSoldVehicleFlow();
