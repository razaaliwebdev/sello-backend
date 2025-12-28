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

/**
 * Delete image(s) from Cloudinary
 * @param {String|Array<String>} imageUrls - Single URL or array of URLs to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deleteCloudinaryImages = async (imageUrls) => {
    try {
        if (!imageUrls || (Array.isArray(imageUrls) && imageUrls.length === 0)) {
            return { deleted: [], failed: [] };
        }

        // Normalize to array
        const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
        
        // Extract public IDs from Cloudinary URLs
        const extractPublicId = (url) => {
            if (!url || typeof url !== 'string') return null;
            
            try {
                // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
                // Or: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{public_id}.{format}
                const urlParts = url.split('/');
                const uploadIndex = urlParts.findIndex(part => part === 'upload');
                
                if (uploadIndex === -1) return null;
                
                // Get everything after 'upload' and before the file extension
                const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
                const publicId = pathAfterUpload.replace(/\.[^/.]+$/, ''); // Remove file extension
                
                return publicId;
            } catch (error) {
                Logger.warn("Failed to extract public ID from URL", { url, error: error.message });
                return null;
            }
        };

        const publicIds = urls
            .map(extractPublicId)
            .filter(id => id !== null);

        if (publicIds.length === 0) {
            Logger.warn("No valid Cloudinary public IDs found in URLs", { urls });
            return { deleted: [], failed: urls };
        }

        // Delete images in batch (Cloudinary supports up to 100 at a time)
        const batchSize = 100;
        const deleted = [];
        const failed = [];

        for (let i = 0; i < publicIds.length; i += batchSize) {
            const batch = publicIds.slice(i, i + batchSize);
            
            try {
                const result = await cloudinary.api.delete_resources(batch, {
                    resource_type: 'image',
                    type: 'upload'
                });

                // Cloudinary returns { deleted: { [publicId]: "deleted" }, failed: { [publicId]: "not_found" } }
                if (result.deleted) {
                    Object.keys(result.deleted).forEach(publicId => {
                        deleted.push(publicId);
                    });
                }

                if (result.failed && Object.keys(result.failed).length > 0) {
                    Object.keys(result.failed).forEach(publicId => {
                        failed.push(publicId);
                        Logger.warn("Failed to delete image from Cloudinary", { 
                            publicId, 
                            reason: result.failed[publicId] 
                        });
                    });
                }
            } catch (error) {
                Logger.error("Error deleting batch from Cloudinary", error, { batch });
                failed.push(...batch);
            }
        }

        return { deleted, failed };
    } catch (error) {
        Logger.error("Error in deleteCloudinaryImages", error, { imageUrls });
        return { deleted: [], failed: Array.isArray(imageUrls) ? imageUrls : [imageUrls] };
    }
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
