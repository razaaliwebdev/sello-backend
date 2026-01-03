import mongoose from "mongoose";
import Logger from "./../utils/logger.js";

const connectDB = async () => {
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sello-db";

  try {
    // Configure MongoDB connection with retry logic
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s (increased from 5s)
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 20, // Increase from 10 to 20 for better concurrency
      minPoolSize: 5, // Increase from 2 to 5 for better performance
      maxIdleTimeMS: 30000, // Close idle connections after 30s
      retryWrites: true, // Retry failed writes
      retryReads: true, // Retry failed reads
    });
    Logger.info("MongoDb Connected Successfully...");
    console.log("✅ MongoDB connected");

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      Logger.error("MongoDB connection error", err);
    });

    mongoose.connection.on("disconnected", () => {
      Logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      Logger.info("MongoDB reconnected");
    });
  } catch (error) {
    // Log error but don't exit - let server start anyway
    // MongoDB will auto-reconnect when available
    Logger.error("Failed to connect to MongoDB", error, {
      mongoUri: mongoUri.replace(/\/\/.*@/, "//***@"), // Hide credentials in logs
    });
    console.error("❌ MongoDB connection failed:", error.message);
  }
};

export default connectDB;
