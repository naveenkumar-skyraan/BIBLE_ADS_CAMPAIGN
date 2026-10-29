import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const uploadDirectory = path.resolve("public/uploads/ads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
]);

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${randomUUID()}${extension}`);
    },
});

const fileFilter = (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
        return callback(
            new Error(
                "Only JPG, PNG, WebP, MP4, WebM, and MOV files are allowed."
            )
        );
    }

    callback(null, true);
};

const adUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024,
        files: 1,
    },
});

export default adUpload;