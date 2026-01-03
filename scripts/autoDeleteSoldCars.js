/**
 * Nightly cleanup script to auto-delete sold listings after X days.
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
 *   - Delete images from Cloudinary
 *
 * Usage (example cron):
 *   node server/scripts/autoDeleteSoldCars.js
 *
 * Environment variables:
 *   SOLD_LISTING_AUTO_DELETE_DAYS - Days before auto-deletion (default: 30)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "../models/carModel.js";
import User from "../models/userModel.js";
import ListingHistory from "../models/listingHistoryModel.js";
import { deleteCloudinaryImages } from "../utils/cloudinary.js";
import Logger from "../utils/logger.js";

dotenv.config();

const AUTO_DELETE_DAYS =
  parseInt(process.env.SOLD_LISTING_AUTO_DELETE_DAYS) || 30;

const runAutoDelete = async () => {
  const startTime = Date.now();
  let totalDeleted = 0;
  let totalImagesDeleted = 0;
  let totalImagesFailed = 0;
  let errors = [];

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not set in environment variables.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for auto-delete job");

    const now = new Date();
    const AUTO_DELETE_DAYS =
      parseInt(process.env.SOLD_LISTING_AUTO_DELETE_DAYS) || 30;

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

    console.log(
      `🧹 Found ${carsToDelete.length} sold listings to auto-delete (${AUTO_DELETE_DAYS} days policy)`
    );

    // Log statistics
    const stats = {
      totalFound: carsToDelete.length,
      totalImages: carsToDelete.reduce(
        (sum, car) => sum + (car.images?.length || 0),
        0
      ),
      avgAge:
        carsToDelete.length > 0
          ? Math.round(
              (now -
                new Date(carsToDelete[0].soldAt || carsToDelete[0].createdAt)) /
                (1000 * 60 * 60 * 24)
            )
          : 0,
    };
    console.log(
      `📊 Statistics: ${stats.totalFound} cars, ${stats.totalImages} images, avg ${stats.avgAge} days old`
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const car of carsToDelete) {
        const deletedAt = new Date();
        let carImagesDeleted = 0;
        let carImagesFailed = 0;

        // Delete images from Cloudinary before deleting car
        if (car.images && Array.isArray(car.images) && car.images.length > 0) {
          try {
            const deleteResult = await deleteCloudinaryImages(car.images);
            carImagesDeleted = deleteResult.deleted.length;
            carImagesFailed = deleteResult.failed.length;
            totalImagesDeleted += carImagesDeleted;
            totalImagesFailed += carImagesFailed;

            console.log(
              `  ✅ Deleted ${carImagesDeleted} images from Cloudinary for car ${car._id}`
            );

            if (carImagesFailed > 0) {
              console.warn(
                `  ⚠️  Failed to delete ${carImagesFailed} images from Cloudinary for car ${car._id}`
              );
              errors.push({
                carId: car._id,
                type: "image_deletion",
                failed: carImagesFailed,
                success: carImagesDeleted,
              });
            }
          } catch (imageError) {
            carImagesFailed = car.images.length;
            totalImagesFailed += carImagesFailed;
            console.error(
              `  ❌ Error deleting images from Cloudinary for car ${car._id}:`,
              imageError.message
            );
            errors.push({
              carId: car._id,
              type: "image_deletion_error",
              error: imageError.message,
              totalImages: car.images.length,
            });
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
              imagesDeleted: carImagesDeleted,
              imagesFailed: carImagesFailed,
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
        totalDeleted++;
      }

      await session.commitTransaction();

      const duration = Date.now() - startTime;
      console.log("✅ Auto-delete job completed successfully.");
      console.log(
        `📈 Final Results: ${totalDeleted} cars deleted, ${totalImagesDeleted} images deleted, ${totalImagesFailed} images failed`
      );
      console.log(`⏱️ Duration: ${Math.round(duration / 1000)}s`);

      // Log any errors for monitoring
      if (errors.length > 0) {
        console.log("⚠️ Errors encountered:");
        errors.forEach((error) => {
          console.log(
            `  - Car ${error.carId}: ${error.type} - ${
              error.error || `${error.failed} failed`
            }`
          );
        });

        // Send to monitoring system if available
        if (process.env.SENTRY_DSN) {
          try {
            const Sentry = await import("@sentry/node");
            Sentry.default.captureMessage(
              "Auto-delete job completed with errors",
              {
                level: "warning",
                extra: {
                  totalDeleted,
                  totalImagesDeleted,
                  totalImagesFailed,
                  errors,
                  duration: `${duration}ms`,
                  autoDeleteDays: AUTO_DELETE_DAYS,
                },
              }
            );
          } catch (sentryError) {
            console.warn(
              "Could not send error report to Sentry:",
              sentryError.message
            );
          }
        }
      }
    } catch (error) {
      await session.abortTransaction();
      console.error("❌ Auto-delete job failed, transaction aborted:", error);

      // Send critical error to monitoring
      if (process.env.SENTRY_DSN) {
        try {
          const Sentry = await import("@sentry/node");
          Sentry.default.captureException(error, {
            extra: {
              totalDeleted,
              totalImagesDeleted,
              totalImagesFailed,
              autoDeleteDays: AUTO_DELETE_DAYS,
              duration: `${Date.now() - startTime}ms`,
            },
          });
        } catch (sentryError) {
          console.warn(
            "Could not send critical error to Sentry:",
            sentryError.message
          );
        }
      }

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

    // Send critical error to monitoring
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = await import("@sentry/node");
        Sentry.default.captureException(error, {
          extra: {
            autoDeleteDays: AUTO_DELETE_DAYS,
          },
        });
      } catch (sentryError) {
        console.warn(
          "Could not send critical error to Sentry:",
          sentryError.message
        );
      }
    }

    process.exit(1);
  }
};

runAutoDelete();
