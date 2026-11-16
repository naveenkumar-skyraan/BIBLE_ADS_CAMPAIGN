import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const uploadDirectory = path.resolve(
  "private_uploads/ad-moderation",
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

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
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = allowedTypes[file.mimetype];

  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    return callback(
      new Error("Only PDF, JPG, and PNG documents are allowed."),
    );
  }

  callback(null, true);
};

const adModerationUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export default adModerationUpload;