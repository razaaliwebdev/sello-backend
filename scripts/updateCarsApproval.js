/**
 * Script to update all existing cars to have isApproved: true
 * Run this once to fix existing cars in the database
 * 
 * Usage: node server/scripts/updateCarsApproval.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Car from '../models/carModel.js';

dotenv.config();

const updateCarsApproval = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Update all cars that don't have isApproved set or have it as false
        const result = await Car.updateMany(
            { 
                $or: [
                    { isApproved: { $exists: false } },
                    { isApproved: false }
                ]
            },
            { 
                $set: { 
                    isApproved: true,
                    approvedAt: new Date()
                } 
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} cars to be approved`);
        console.log(`📊 Total cars matched: ${result.matchedCount}`);

        // Close connection
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating cars:', error);
        process.exit(1);
    }
};

updateCarsApproval();

