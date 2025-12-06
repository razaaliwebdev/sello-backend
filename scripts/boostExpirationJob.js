/**
 * Background Job: Boost Expiration
 * Runs periodically to check and expire boosted listings
 * 
 * Usage:
 *   - Add to cron: */30 * * * * node server/scripts/boostExpirationJob.js
 *   - Or use node-cron in server.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "../models/carModel.js";
import Logger from "../utils/logger.js";

dotenv.config();

const runBoostExpiration = async () => {
    try {
        if (!process.env.MONGO_URI) {
            Logger.error("MONGO_URI is not set in environment variables.");
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        Logger.info("Connected to MongoDB for boost expiration job");

        const now = new Date();

        // Find expired boosts
        const expiredBoosts = await Car.find({
            isBoosted: true,
            boostExpiry: { $lt: now }
        }).select('_id title isBoosted boostExpiry');

        if (expiredBoosts.length === 0) {
            Logger.info("No expired boosts found.");
            await mongoose.connection.close();
            process.exit(0);
        }

        Logger.info(`Found ${expiredBoosts.length} expired boosts to process`);

        // Update expired boosts
        const result = await Car.updateMany(
            {
                isBoosted: true,
                boostExpiry: { $lt: now }
            },
            {
                $set: {
                    isBoosted: false,
                    boostPriority: 0
                }
            }
        );

        Logger.info(`Successfully expired ${result.modifiedCount} boosts`);

        await mongoose.connection.close();
        Logger.info("MongoDB connection closed");
        process.exit(0);
    } catch (error) {
        Logger.error("Error running boost expiration script", error);
        try {
            await mongoose.connection.close();
        } catch {
            // ignore
        }
        process.exit(1);
    }
};

runBoostExpiration();

