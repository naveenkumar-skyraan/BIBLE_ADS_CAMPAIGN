import fs from "fs/promises";
import path from "path";

import {
  loginAdmin,
  getAdminProfile,
  updateAdminProfileDetails,
} from "../services/adminAuthService.js";

import {
  adminLoginSchema,
  adminProfileUpdateSchema,
} from "../validators/adminAuthValidator.js";

const uploadDirectory = path.resolve(
  process.cwd(),
  "public/uploads/admin-profiles",
);

const deleteUploadedFile = async (filename) => {
  if (!filename) return;

  try {
    await fs.unlink(path.join(uploadDirectory, filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("PROFILE IMAGE DELETE ERROR:", error);
    }
  }
};

const sendValidationErrors = (res, error) => {
  const errors = {};

  error.details.forEach((detail) => {
    const field = detail.path[0];

    if (!errors[field]) {
      errors[field] = detail.message;
    }
  });

  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
};

export const loginAdminController = async (req, res) => {
  try {
    const { error, value } = adminLoginSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return sendValidationErrors(res, error);
    }

    const admin = await loginAdmin(value.email, value.password);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: admin,
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Internal server error",
    });
  }
};

export const getAdminProfileController = async (req, res) => {
  try {
    const admin = await getAdminProfile(req.admin.id);

    return res.status(200).json({
      success: true,
      message: "Admin profile retrieved successfully",
      data: admin,
    });
  } catch (error) {
    console.error("GET ADMIN PROFILE ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Internal server error",
    });
  }
};

export const updateAdminProfileController = async (req, res) => {
  let updated = false;

  try {
    const { error, value } = adminProfileUpdateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return sendValidationErrors(res, error);
    }

    const oldAdmin = await getAdminProfile(req.admin.id);

    const admin = await updateAdminProfileDetails(req.admin.id, {
      name: value.name,
      email: value.email,
      profileImage: req.file
        ? `/uploads/admin-profiles/${req.file.filename}`
        : null,
      changePassword: value.changePassword,
      oldPassword: value.oldPassword,
      newPassword: value.newPassword,
    });

    updated = true;

    if (
      req.file &&
      oldAdmin.profile_image &&
      oldAdmin.profile_image !== admin.profile_image
    ) {
      const oldFilename = path.basename(oldAdmin.profile_image);
      await deleteUploadedFile(oldFilename);
    }

    return res.status(200).json({
      success: true,
      message: "Admin profile updated successfully",
      data: admin,
    });
  } catch (error) {
    console.error("UPDATE ADMIN PROFILE ERROR:", error);

    if (!updated && req.file) {
      await deleteUploadedFile(req.file.filename);
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Internal server error",
    });
  }
};
