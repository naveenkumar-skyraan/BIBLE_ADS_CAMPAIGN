
import profileModel from "../models/profileModel.js";

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
        const existingProfile =
            await profileModel.findProfileById(userId);

        if (!existingProfile) {
            throw createError("USER_NOT_FOUND", "User not found.");
        }

        const phoneExists = await profileModel.findUserByPhone(
            data.phone,
            userId
        );

        if (phoneExists) {
            throw createError(
                "PHONE_ALREADY_REGISTERED",
                "Phone number is already registered."
            );
        }

        const email =
            data.email?.trim() || null;

        await profileModel.updateProfile(userId, {
            name: data.name,
            phone: data.phone,
            email
        });

        return await profileModel.findProfileById(userId);
    }
};

export default profileService;
