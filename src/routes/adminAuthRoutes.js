import express from "express";

import {
  loginAdminController,
  getAdminProfileController,
  updateAdminProfileController,
} from "../controllers/adminAuthController.js";

import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";
import { uploadAdminProfileImage } from "../middleware/adminProfileUpload.js";

const router = express.Router();

router.post("/login", loginAdminController);

router.get("/profile", adminAuthMiddleware, getAdminProfileController);

router.put(
  "/profile",
  adminAuthMiddleware,
  uploadAdminProfileImage,
  updateAdminProfileController,
);

export default router;
