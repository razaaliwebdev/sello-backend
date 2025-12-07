import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage(); // ✅ Store file in memory

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

    if (!allowedTypes.includes(ext)) {
        return cb(new Error("Only images (jpg, jpeg, png, webp) and PDF files are allowed"), false);
    }

    // Additional MIME type check
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error("Invalid file type. Only images and PDF files are allowed"), false);
    }

    cb(null, true);
};

export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB per file
        files: 20, // Maximum number of files (matches frontend limit)
        fieldSize: 10 * 1024 * 1024 // 10MB for other fields
    }
});

// Single file upload for avatars
export const uploadSingle = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB for avatars
        files: 1
    }
});



