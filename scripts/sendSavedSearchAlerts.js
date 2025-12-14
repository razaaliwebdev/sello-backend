/**
 * Cron job script to send email alerts for saved searches
 * Run this periodically (e.g., every hour) to send alerts
 * 
 * Usage: node server/scripts/sendSavedSearchAlerts.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sendSavedSearchAlerts } from '../controllers/savedSearchController.js';
import connectDB from '../config/db.js';
import Logger from '../utils/logger.js';

dotenv.config();

const runSavedSearchAlerts = async () => {
    try {
        Logger.info('Starting saved search alerts job...');
        
        // Connect to database
        await connectDB();
        Logger.info('Database connected');

        // Send alerts
        const result = await sendSavedSearchAlerts();
        
        Logger.info('Saved search alerts job completed', result);
        
        // Close connection
        await mongoose.connection.close();
        Logger.info('Database connection closed');
        
        process.exit(0);
    } catch (error) {
        Logger.error('Error in saved search alerts job', error);
        process.exit(1);
    }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runSavedSearchAlerts();
}

export default runSavedSearchAlerts;
