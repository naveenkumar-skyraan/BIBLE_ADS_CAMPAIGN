
import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const uploadDirectory = path.resolve("uploads/issue-reports");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    callback(null, filename);
  }
});

const fileFilter = (req, file, callback) => {
  const allowedTypes = ["image/png", "image/jpeg"];

  if (!allowedTypes.includes(file.mimetype)) {
    return callback(new Error("Only PNG and JPG images are allowed"));
  }

  callback(null, true);
};

const issueReportUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

export default issueReportUpload;
