import profileService from "../services/profileService.js";
import { updateProfileSchema } from "../validators/profileValidator.js";

const validate = (schema, body) =>
  schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

export const getProfileController = async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully.",
      data: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const updateProfileController = async (req, res) => {
  try {
    const { error, value } = validate(updateProfileSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const profile = await profileService.updateProfile(req.user.id, value);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      PHONE_ALREADY_REGISTERED: 409,
      PROFILE_PHONE_NOT_VERIFIED: 403,
      PHONE_VERIFICATION_REQUIRED: 400,
      INVALID_PHONE_VERIFICATION_TOKEN: 400,
    };

    if (statusCodes[error.code]) {
      return res.status(statusCodes[error.code]).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
