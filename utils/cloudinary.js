import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 60000 // 60 seconds timeout instead of default
});

export const uploadCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "avatars",
                resource_type: "image"
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload error:", error);
                    return reject(error);
                }
                resolve(result.secure_url);
            }
        );

        stream.end(fileBuffer); // Send file buffer
    });
};



// import { v2 as cloudinary } from 'cloudinary';
// import dotenv from 'dotenv';
// import fs from 'fs';

// dotenv.config();

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET
// });

// export const uploadCloudinary = async (filePath) => {
//     const result = await cloudinary.uploader.upload(filePath, {
//         folder: "avatars", // or "sello_cars" based on usage
//         resource_type: "image"
//     });

//     // ✅ Only try to delete local files, not URLs
//     if (filePath.startsWith("/tmp") || filePath.startsWith("E:") || filePath.startsWith("./") || filePath.endsWith(".jpg")) {
//         try {
//             fs.unlinkSync(filePath);
//         } catch (err) {
//             console.warn("Warning: Failed to delete local file", err.message);
//         }
//     }

//     return result.secure_url;
// };
