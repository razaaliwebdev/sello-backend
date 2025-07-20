import mongoose from 'mongoose';


const connectDB = async (req, res) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected Successfully...");
    } catch (error) {
        console.log("Failed to connect mongoDB...", error);
        process.exit(1);
    };
};

export default connectDB;