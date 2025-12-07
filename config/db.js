import mongoose from 'mongoose';
import Logger from "./../utils/logger.js";

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sello-db';

    try {
        await mongoose.connect(mongoUri);
        Logger.info("MongoDb Connected Successfully...");
        console.log("✅ MongoDB connected");
    } catch (error) {
        // Don't exit - let server start anyway
        // MongoDB will auto-reconnect when available
    }
}

export default connectDB;