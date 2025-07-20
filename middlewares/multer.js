

import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({});

const fileFilter = (req, file, cb) => {
    if (!file) {
        return cb(new Error("No file provided"), false);
    }

    const ext = path.extname(file.originalname).toLowerCase();

    const allowedTypes = ['.jpg', '.jpeg', '.png'];

    if (!allowedTypes.includes(ext)) {
        return cb(new Error("Only images (jpg, jpeg, png) are allowed"), false);
    }

    cb(null, true);
};

export const upload = multer({ storage, fileFilter });
