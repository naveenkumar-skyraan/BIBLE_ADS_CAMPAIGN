import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
    getAdminByEmail,
    getAdminProfileById,
    getAdminPasswordById,
    getAdminByEmailExceptId,
    updateAdminProfileAndPassword
} from "../models/adminAuthModel.js";

export const loginAdmin = async (email, password) => {
    const admin = await getAdminByEmail(email);

    if (!admin) {
        const error = new Error("Invalid email or password.");
        error.statusCode = 401;
        throw error;
    }

    if (admin.is_active !== 1) {
        const error = new Error("Admin account is inactive.");
        error.statusCode = 403;
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        admin.password_hash
    );

    if (!isPasswordValid) {
        const error = new Error("Invalid email or password.");
        error.statusCode = 401;
        throw error;
    }

    const accessToken = jwt.sign(
        {
            sub: String(admin.id),
            type: "access",
            role: "admin"
        },
        process.env.JWT_ACCESS_SECRET
    );

    return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        profile_image: admin.profile_image,
        accessToken
    };
};

export const getAdminProfile = async (adminId) => {
    const admin = await getAdminProfileById(adminId);

    if (!admin) {
        const error = new Error("Admin not found.");
        error.statusCode = 404;
        throw error;
    }

    if (admin.is_active !== 1) {
        const error = new Error("Admin account is inactive.");
        error.statusCode = 403;
        throw error;
    }

    return admin;
};

export const updateAdminProfileDetails = async (
    adminId,
    {
        name,
        email,
        profileImage,
        changePassword,
        oldPassword,
        newPassword
    }
) => {
    const admin = await getAdminProfileById(adminId);

    if (!admin) {
        const error = new Error("Admin not found.");
        error.statusCode = 404;
        throw error;
    }

    if (admin.is_active !== 1) {
        const error = new Error("Admin account is inactive.");
        error.statusCode = 403;
        throw error;
    }

    if (changePassword) {
        const adminPassword = await getAdminPasswordById(adminId);

        const isPasswordValid = await bcrypt.compare(
            oldPassword,
            adminPassword.password_hash
        );

        if (!isPasswordValid) {
            const error = new Error("Current password is incorrect.");
            error.statusCode = 400;
            throw error;
        }
    }

    const existingEmail = await getAdminByEmailExceptId(
        email,
        adminId
    );

    if (existingEmail) {
        const error = new Error(
            "This email address is already registered."
        );
        error.statusCode = 409;
        throw error;
    }

    const passwordHash = changePassword
        ? await bcrypt.hash(newPassword, 12)
        : null;

    return await updateAdminProfileAndPassword(adminId, {
        name,
        email,
        profileImage,
        passwordHash
    });
};