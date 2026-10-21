import profileModel from "../models/profileModel.js";
import { findUserById } from "../models/userModel.js";

const createError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const profileService = {
  async getProfile(userId) {
    const profile = await profileModel.findProfileById(userId);

    if (!profile) {
      throw createError("USER_NOT_FOUND", "User not found.");
    }

    return profile;
  },

  async updateProfile(userId, data) {
    const existingProfile = await profileModel.findProfileById(userId);

    if (!existingProfile) {
      throw createError("USER_NOT_FOUND", "User not found.");
    }

    const user = await findUserById(userId);

    if (!user) {
      throw createError("USER_NOT_FOUND", "User not found.");
    }

    const requestedPhone = data.phone?.trim() || null;
    const existingPhone = existingProfile.phone || null;
    const phoneChanged = requestedPhone !== existingPhone;

    if (requestedPhone && Number(user.is_phone_verified) !== 1) {
      throw createError(
        "PHONE_VERIFICATION_REQUIRED",
        "Verify the phone number before updating your profile.",
      );
    }

    if (phoneChanged) {
      if (Number(user.is_oauth_login) !== 1) {
        throw createError(
          "PROFILE_PHONE_NOT_ALLOWED",
          "Phone number cannot be changed for phone-login accounts.",
        );
      }

      if (requestedPhone) {
        if (user.phone !== requestedPhone) {
          throw createError(
            "PHONE_VERIFICATION_REQUIRED",
            "Verify the requested phone number before updating your profile.",
          );
        }

        const phoneExists = await profileModel.findUserByPhone(
          requestedPhone,
          userId,
        );

        if (phoneExists) {
          throw createError(
            "PHONE_ALREADY_REGISTERED",
            "Phone number is already registered.",
          );
        }
      }
    }

    const email = data.email?.trim() || null;

    await profileModel.updateProfile(userId, {
      name: data.name,
      phone: requestedPhone,
      email,
    });

    return await profileModel.findProfileById(userId);
  },
};

export default profileService;
