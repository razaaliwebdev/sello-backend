import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage(); // ✅ Store file in memory

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedTypes = ['.jpg', '.jpeg', '.png'];

    if (!allowedTypes.includes(ext)) {
        return cb(new Error("Only images (jpg, jpeg, png) are allowed"), false);
    }

    cb(null, true);
};

export const upload = multer({
    storage: multer.memoryStorage(), // or your preferred storage
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB (adjust as needed)
        files: 8 // Maximum number of files
    }
});



