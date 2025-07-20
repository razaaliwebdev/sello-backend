import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadCloudinary = async (filePath) => {
    const result = await cloudinary.uploader.upload(filePath, {
        folder: "avatars", // or "sello_cars" based on usage
        resource_type: "image"
    });

    // ✅ Only try to delete local files, not URLs
    if (filePath.startsWith("/tmp") || filePath.startsWith("E:") || filePath.startsWith("./") || filePath.endsWith(".jpg")) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.warn("Warning: Failed to delete local file", err.message);
        }
    }

    return result.secure_url;
};
