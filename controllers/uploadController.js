import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        // Upload to Cloudinary
        const localFilePath = req.file.path;
        const cloudinaryResponse = await uploadOnCloudinary(localFilePath);

        // Remove local file
        // fs.unlinkSync(localFilePath); // uploadOnCloudinary usually handles this, but good to be safe if it doesn't

        if (!cloudinaryResponse) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload file to cloud storage"
            });
        }

        return res.status(200).json({
            success: true,
            message: "File uploaded successfully",
            data: {
                url: cloudinaryResponse.secure_url,
                publicId: cloudinaryResponse.public_id
            }
        });

    } catch (error) {
        console.error("Upload Error:", error);
        // Ensure local file is cleaned up
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error during upload"
        });
    }
};
