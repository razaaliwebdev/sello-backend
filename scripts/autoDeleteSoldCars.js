/**
 * Nightly cleanup script to auto-delete sold listings after 7 days.
 *
 * Behaviour:
 * - Find all cars where:
 *     status = 'sold'
 *     isAutoDeleted = false
 *     autoDeleteDate < now
 * - For each:
 *   - Create a ListingHistory record (no images)
 *   - Mark car as deleted and auto-deleted
 *   - Remove the car document
 *   - Pull the car from the seller's carsPosted array
 *
 * Usage (example cron):
 *   node server/scripts/autoDeleteSoldCars.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "../models/carModel.js";
import User from "../models/userModel.js";
import ListingHistory from "../models/listingHistoryModel.js";
import { deleteCloudinaryImages } from "../utils/cloudinary.js";

dotenv.config();

const runAutoDelete = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not set in environment variables.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for auto-delete job");

    const now = new Date();

    // Find sold cars past their autoDeleteDate which haven't been auto-deleted yet
    const carsToDelete = await Car.find({
      status: "sold",
      isAutoDeleted: false,
      autoDeleteDate: { $lt: now },
    }).lean();

    if (!carsToDelete.length) {
      console.log("ℹ️ No sold listings eligible for auto-deletion.");
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`🧹 Found ${carsToDelete.length} sold listings to auto-delete`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const car of carsToDelete) {
        const deletedAt = new Date();

        // Delete images from Cloudinary before deleting car
        if (car.images && Array.isArray(car.images) && car.images.length > 0) {
          try {
            const deleteResult = await deleteCloudinaryImages(car.images);
            console.log(`  ✅ Deleted ${deleteResult.deleted.length} images from Cloudinary for car ${car._id}`);
            
            if (deleteResult.failed.length > 0) {
              console.warn(`  ⚠️  Failed to delete ${deleteResult.failed.length} images from Cloudinary for car ${car._id}`);
            }
          } catch (imageError) {
            console.error(`  ❌ Error deleting images from Cloudinary for car ${car._id}:`, imageError.message);
            // Continue with deletion even if image deletion fails
          }
        }

        // Create history record (no images)
        await ListingHistory.create(
          [
            {
              oldListingId: car._id,
              title: car.title,
              make: car.make,
              model: car.model,
              year: car.year,
              mileage: car.mileage,
              finalStatus: "sold",
              finalSellingDate: car.soldAt || car.soldDate || deletedAt,
              sellerUser: car.postedBy,
              isAutoDeleted: true,
              deletedBy: null,
              deletedAt,
            },
          ],
          { session }
        );

        // Mark as deleted & auto-deleted
        await Car.updateOne(
          { _id: car._id },
          {
            $set: {
              status: "deleted",
              isAutoDeleted: true,
              deletedAt,
              deletedBy: null,
            },
          },
          { session }
        );

        // Remove car from seller's carsPosted array
        if (car.postedBy) {
          await User.updateOne(
            { _id: car.postedBy },
            { $pull: { carsPosted: car._id } },
            { session }
          );
        }

        // Finally remove the car document to keep active listings clean
        await Car.deleteOne({ _id: car._id }, { session });
      }

      await session.commitTransaction();
      console.log("✅ Auto-delete job completed successfully.");
    } catch (error) {
      await session.abortTransaction();
      console.error("❌ Auto-delete job failed, transaction aborted:", error);
      process.exitCode = 1;
    } finally {
      session.endSession();
    }

    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(process.exitCode || 0);
  } catch (error) {
    console.error("❌ Error running auto-delete script:", error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

runAutoDelete();


