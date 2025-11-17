import mongoose from 'mongoose';


const connectDB = async (req, res) => {
    try {
        if (!process.env.MONGO_URI) {
            console.log("⚠️  Warning: MONGO_URI is not set in environment variables");
            console.log("⚠️  Server will start but database operations will fail");
            return;
        }
        
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        });
        console.log("✅ MongoDB Connected Successfully...");
    } catch (error) {
        console.log("❌ Failed to connect mongoDB...", error.message);
        console.log("⚠️  Server will continue to run, but database operations will fail");
        console.log("⚠️  Please check your MONGO_URI in .env file");
        // Don't exit - allow server to start for testing
        // process.exit(1);
    };
};

export default connectDB;