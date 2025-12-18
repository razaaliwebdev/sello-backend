import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import Logger from './logger.js';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 60000 // 60 seconds timeout instead of default
});

/**
 * Upload image to Cloudinary with compression, EXIF removal, and optimization
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options
 * @param {String} options.folder - Cloudinary folder (default: "sello_cars")
 * @param {Boolean} options.removeExif - Remove EXIF data (default: true)
 * @param {Number} options.quality - Image quality 1-100 (default: 80)
 * @param {String} options.format - Output format (default: "auto" for auto format)
 * @returns {Promise<String>} Secure URL of uploaded image
 */
export const uploadCloudinary = (fileBuffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const {
            folder = "sello_cars",
            removeExif = true,
            quality = 80,
            format = "auto"
        } = options;

        const uploadOptions = {
            folder: folder,
            resource_type: "image",
            // Compression and optimization
            quality: quality,
            fetch_format: format, // auto, jpg, png, webp
            // Remove EXIF data for privacy and smaller file size
            strip_metadata: removeExif,
            // Auto-optimize images
            transformation: [
                {
                    quality: "auto:good", // Cloudinary auto quality
                    fetch_format: "auto", // Auto format (webp when supported)
                }
            ],
            // Limit image dimensions (optional - adjust as needed)
            // width: 1920,
            // height: 1080,
            // crop: "limit"
        };

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    Logger.error("Cloudinary upload error", error);
                    return reject(error);
                }
                resolve(result.secure_url);
            }
        );

        stream.end(fileBuffer); // Send file buffer
    });
};



import fs from 'fs';

/**
 * Upload image from file path to Cloudinary (for avatar uploads)
 * @param {String} filePath - Local file path
 * @param {Object} options - Upload options
 * @returns {Promise<Object|null>} Cloudinary result or null
 */
export const uploadOnCloudinary = async (filePath, options = {}) => {
    try {
        if (!filePath) return null;

        const {
            folder = "avatars",
            quality = 80,
            removeExif = true
        } = options;

        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: "image",
            quality: quality,
            fetch_format: "auto",
            strip_metadata: removeExif,
            transformation: [
                {
                    quality: "auto:good",
                    fetch_format: "auto",
                }
            ]
        });

        // ✅ Only try to delete local files, not URLs
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                Logger.warn("Failed to delete local file after Cloudinary upload", { 
                    filePath, 
                    error: err.message 
                });
            }
        }

        return result;
    } catch (error) {
        // Remove file on error
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return null;
    }
};
