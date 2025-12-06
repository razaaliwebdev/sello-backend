/**
 * Background Job: Subscription Expiration
 * Runs daily to check and expire user subscriptions
 * 
 * Usage:
 *   - Add to cron: 0 0 * * * node server/scripts/subscriptionExpirationJob.js
 *   - Or use node-cron in server.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/userModel.js";
import Logger from "../utils/logger.js";

dotenv.config();

const runSubscriptionExpiration = async () => {
    try {
        if (!process.env.MONGO_URI) {
            Logger.error("MONGO_URI is not set in environment variables.");
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        Logger.info("Connected to MongoDB for subscription expiration job");

        const now = new Date();

        // Find expired subscriptions
        const expiredSubscriptions = await User.find({
            "subscription.isActive": true,
            "subscription.endDate": { $lt: now }
        }).select('_id name email subscription');

        if (expiredSubscriptions.length === 0) {
            Logger.info("No expired subscriptions found.");
            await mongoose.connection.close();
            process.exit(0);
        }

        Logger.info(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

        // Update expired subscriptions
        const result = await User.updateMany(
            {
                "subscription.isActive": true,
                "subscription.endDate": { $lt: now }
            },
            {
                $set: {
                    "subscription.isActive": false,
                    "subscription.plan": "free"
                }
            }
        );

        Logger.info(`Successfully expired ${result.modifiedCount} subscriptions`);

        // Send notifications to users (optional)
        // You can add notification logic here

        await mongoose.connection.close();
        Logger.info("MongoDB connection closed");
        process.exit(0);
    } catch (error) {
        Logger.error("Error running subscription expiration script", error);
        try {
            await mongoose.connection.close();
        } catch {
            // ignore
        }
        process.exit(1);
    }
};

runSubscriptionExpiration();

