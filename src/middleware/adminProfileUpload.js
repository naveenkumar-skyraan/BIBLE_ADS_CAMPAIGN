
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDirectory = path.resolve(
    __dirname,
    "../../public/uploads/admin-profiles"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const originalName = path
            .basename(file.originalname, extension)
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 100);

        const timestamp = Date.now();

        const filename = `admin-${req.admin.id}-${timestamp}-${originalName || "profile"}${extension}`;

        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        const error = new Error(
            "Only JPG, PNG and WEBP images are allowed."
        );

        error.statusCode = 400;

        return cb(error);
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }
});

export const uploadAdminProfileImage = (req, res, next) => {
    upload.single("profile_image")(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "Profile image must not exceed 5 MB."
                });
            }

            if (error.code === "LIMIT_UNEXPECTED_FILE") {
                return res.status(400).json({
                    success: false,
                    message: "Only one profile image is allowed. Use the profile_image field."
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error) {
            return res.status(error.statusCode || 400).json({
                success: false,
                message: error.message || "Profile image upload failed."
            });
        }

        next();
    });
};
