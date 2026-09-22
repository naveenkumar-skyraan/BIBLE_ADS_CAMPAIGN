import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
    findUserByPhone,
    findUserById,
    createUser,
    updateOtp,
    verifyPhone,
    clearOtp,
    updatePassword,
    updateRefreshToken,
    clearRefreshToken,
    markAccountForDeletion,
    reactivateAccount
} from "../models/userModel.js";

const REFRESH_SESSION_DAYS = Number(
    process.env.JWT_REFRESH_DAYS
);

const generateOtp = () => {
    return crypto.randomInt(1000, 10000).toString();
};

const getOtpExpiry = () => {
    return new Date(Date.now() + 5 * 60 * 1000);
};

const generateAccessToken = (userId) => {
    return jwt.sign(
        {
            sub: userId,
            type: "access"
        },
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN
        }
    );
};

const generateRefreshToken = (userId, expiresInSeconds) => {
    return jwt.sign(
        {
            sub: userId,
            type: "refresh"
        },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: expiresInSeconds
        }
    );
};

const hashToken = async (token) => {
    return bcrypt.hash(token, 10);
};

const compareToken = async (token, hashedToken) => {
    return bcrypt.compare(token, hashedToken);
};

const getRefreshSessionExpiry = () => {
    const expiry = new Date();

    expiry.setDate(
        expiry.getDate() + REFRESH_SESSION_DAYS
    );

    return expiry;
};

const getRemainingSeconds = (expiresAt) => {
    const remainingMs =
        new Date(expiresAt).getTime() - Date.now();

    if (remainingMs <= 0) {
        return 0;
    }

    return Math.floor(remainingMs / 1000);
};

const createTokens = async (
    userId,
    existingRefreshSessionExpiry = null
) => {
    const accessToken = generateAccessToken(userId);

    const refreshSessionExpiry =
        existingRefreshSessionExpiry
            ? new Date(existingRefreshSessionExpiry)
            : getRefreshSessionExpiry();

    const remainingSeconds =
        getRemainingSeconds(refreshSessionExpiry);

    if (remainingSeconds <= 0) {
        const error = new Error(
            "Refresh session has expired. Please log in again."
        );

        error.code = "INVALID_REFRESH_TOKEN";

        throw error;
    }

    const refreshToken = generateRefreshToken(
        userId,
        remainingSeconds
    );

    const refreshTokenHash =
        await hashToken(refreshToken);

    await updateRefreshToken({
        userId,
        refreshToken: refreshTokenHash,
        refreshTokenExpiresAt: refreshSessionExpiry
    });

    return {
        accessToken,
        refreshToken
    };
};

export const signup = async ({
    name,
    phone,
    password
}) => {
    const existingUser = await findUserByPhone(phone);

    if (existingUser) {
        if (existingUser.is_account_deleted === 1) {
            const deletionDate = new Date(
                existingUser.account_deleted_at
            );

            const expiryDate = new Date(
                deletionDate.getTime() +
                30 * 24 * 60 * 60 * 1000
            );

            if (new Date() <= expiryDate) {
                const error = new Error(
                    "Account is pending deletion. Please reactivate the account by logging in."
                );

                error.code = "ACCOUNT_DELETION_PENDING";

                throw error;
            }
        }

        const error = new Error(
            "Phone number is already registered."
        );

        error.code = "PHONE_ALREADY_REGISTERED";

        throw error;
    }

    const passwordHash = await bcrypt.hash(
        password,
        12
    );

    const otp = generateOtp();

    const otpExpiresAt = getOtpExpiry();

    const userId = await createUser({
        name,
        phone,
        passwordHash,
        otp,
        otpExpiresAt,
        otpPurpose: "signup"
    });

    return {
        userId,
        otp
    };
};

export const verifyOtp = async ({
    phone,
    otp
}) => {
    const user = await findUserByPhone(phone);

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const error = new Error(
            "Account is pending deletion."
        );

        error.code = "ACCOUNT_DELETION_PENDING";

        throw error;
    }

    if (!user.otp || !user.otp_expires_at) {
        const error = new Error(
            "No active OTP found."
        );

        error.code = "OTP_NOT_FOUND";

        throw error;
    }

    if (
        new Date(user.otp_expires_at) <
        new Date()
    ) {
        const error = new Error(
            "OTP has expired."
        );

        error.code = "OTP_EXPIRED";

        throw error;
    }

    if (user.otp !== otp) {
        const error = new Error(
            "Invalid OTP."
        );

        error.code = "INVALID_OTP";

        throw error;
    }

    const purpose = user.otp_purpose;

    if (purpose === "signup") {
        await verifyPhone(user.id);

        return {
            purpose: "signup"
        };
    }

    await clearOtp(user.id);

    if (purpose === "forgot_password") {
        const resetToken = jwt.sign(
            {
                sub: user.id,
                type: "password_reset"
            },
            process.env.JWT_ACCESS_SECRET,
            {
                expiresIn: "10m"
            }
        );

        return {
            purpose: "forgot_password",
            resetToken
        };
    }

    const error = new Error(
        "Invalid OTP purpose."
    );

    error.code = "INVALID_OTP_PURPOSE";

    throw error;
};

export const resendOtp = async ({
    phone,
    purpose
}) => {
    const user = await findUserByPhone(phone);

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const error = new Error(
            "Account is pending deletion."
        );

        error.code = "ACCOUNT_DELETION_PENDING";

        throw error;
    }

    if (
        purpose === "signup" &&
        user.is_phone_verified === 1
    ) {
        const error = new Error(
            "Phone number is already verified."
        );

        error.code = "PHONE_ALREADY_VERIFIED";

        throw error;
    }

    const otp = generateOtp();

    const otpExpiresAt = getOtpExpiry();

    await updateOtp({
        userId: user.id,
        otp,
        otpExpiresAt,
        otpPurpose: purpose
    });

    return {
        otp
    };
};

export const login = async ({
    phone,
    password,
    reactivate
}) => {
    const user = await findUserByPhone(phone);

    if (!user) {
        const error = new Error(
            "Invalid phone number or password."
        );

        error.code = "INVALID_CREDENTIALS";

        throw error;
    }

    const passwordValid = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordValid) {
        const error = new Error(
            "Invalid phone number or password."
        );

        error.code = "INVALID_CREDENTIALS";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const deletionDate = new Date(
            user.account_deleted_at
        );

        const expiryDate = new Date(
            deletionDate.getTime() +
            30 * 24 * 60 * 60 * 1000
        );

        if (new Date() > expiryDate) {
            const error = new Error(
                "Account deletion period has expired."
            );

            error.code =
                "ACCOUNT_DELETION_EXPIRED";

            throw error;
        }

        if (!reactivate) {
            const error = new Error(
                "Account is pending deletion. Reactivation is required to continue."
            );

            error.code =
                "ACCOUNT_DELETION_PENDING";

            throw error;
        }

        await reactivateAccount(user.id);
    }

    if (user.is_phone_verified !== 1) {
        const error = new Error(
            "Phone number is not verified."
        );

        error.code = "PHONE_NOT_VERIFIED";

        throw error;
    }

    const tokens = await createTokens(
        user.id
    );

    return {
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone
        },
        ...tokens
    };
};

export const refreshAccessToken = async (
    refreshToken
) => {
    let decoded;

    try {
        decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );
    } catch {
        const error = new Error(
            "Invalid or expired refresh token."
        );

        error.code = "INVALID_REFRESH_TOKEN";

        throw error;
    }

    if (decoded.type !== "refresh") {
        const error = new Error(
            "Invalid refresh token."
        );

        error.code = "INVALID_REFRESH_TOKEN";

        throw error;
    }

    const user = await findUserById(
        decoded.sub
    );

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const error = new Error(
            "Account is pending deletion."
        );

        error.code = "ACCOUNT_DELETION_PENDING";

        throw error;
    }

    if (
        !user.refresh_token ||
        !user.refresh_token_expires_at
    ) {
        const error = new Error(
            "Refresh token is no longer valid."
        );

        error.code = "INVALID_REFRESH_TOKEN";

        throw error;
    }

    if (
        new Date(user.refresh_token_expires_at) <=
        new Date()
    ) {
        await clearRefreshToken(user.id);

        const error = new Error(
            "Refresh session has expired. Please log in again."
        );

        error.code = "INVALID_REFRESH_TOKEN";

        throw error;
    }

    const validStoredToken =
        await compareToken(
            refreshToken,
            user.refresh_token
        );

    if (!validStoredToken) {
        await clearRefreshToken(user.id);

        const error = new Error(
            "Refresh token reuse detected. Please log in again."
        );

        error.code = "INVALID_REFRESH_TOKEN";

        throw error;
    }

    const tokens = await createTokens(
        user.id,
        user.refresh_token_expires_at
    );

    return tokens;
};

export const logout = async (userId) => {
    const user = await findUserById(userId);

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    await clearRefreshToken(userId);
};

export const forgotPassword = async (phone) => {
    const user = await findUserByPhone(phone);

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const error = new Error(
            "Account is pending deletion."
        );

        error.code = "ACCOUNT_DELETION_PENDING";

        throw error;
    }

    const otp = generateOtp();

    const otpExpiresAt = getOtpExpiry();

    await updateOtp({
        userId: user.id,
        otp,
        otpExpiresAt,
        otpPurpose: "forgot_password"
    });

    return {
        otp
    };
};

export const resetPassword = async ({
    reset_token,
    password
}) => {
    let decoded;

    try {
        decoded = jwt.verify(
            reset_token,
            process.env.JWT_ACCESS_SECRET
        );
    } catch (jwtError) {
        console.error(
            "RESET TOKEN ERROR:",
            jwtError.name,
            jwtError.message
        );

        const error = new Error(
            "Invalid or expired reset token."
        );

        error.code = "INVALID_RESET_TOKEN";

        throw error;
    }

    if (decoded.type !== "password_reset") {
        const error = new Error(
            "Invalid reset token."
        );

        error.code = "INVALID_RESET_TOKEN";

        throw error;
    }

    const user = await findUserById(
        decoded.sub
    );

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const error = new Error(
            "Account is pending deletion."
        );

        error.code = "ACCOUNT_DELETION_PENDING";

        throw error;
    }

    const passwordHash = await bcrypt.hash(
        password,
        12
    );

    await updatePassword(
        user.id,
        passwordHash
    );

    await clearRefreshToken(user.id);
};

export const deleteAccount = async ({
    userId,
    password
}) => {
    const user = await findUserById(
        userId
    );

    if (!user) {
        const error = new Error(
            "User not found."
        );

        error.code = "USER_NOT_FOUND";

        throw error;
    }

    if (user.is_account_deleted === 1) {
        const error = new Error(
            "Account is already pending deletion."
        );

        error.code = "ACCOUNT_DELETION_PENDING";

        throw error;
    }

    const passwordValid = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordValid) {
        const error = new Error(
            "Invalid password."
        );

        error.code = "INVALID_PASSWORD";

        throw error;
    }

    await markAccountForDeletion(userId);
};