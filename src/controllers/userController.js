import {
    signup,
    verifyOtp,
    resendOtp,
    login,
    refreshAccessToken,
    logout,
    forgotPassword,
    resetPassword,
    deleteAccount
} from "../services/userService.js";

import {
    signupSchema,
    verifyOtpSchema,
    resendOtpSchema,
    loginSchema,
    refreshTokenSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    deleteAccountSchema
} from "../validators/userValidator.js";

const validate = (schema, body) => {
    return schema.validate(body, {
        abortEarly: false,
        stripUnknown: true
    });
};

export const signupController = async (req, res) => {
    try {
        const { error, value } = validate(
            signupSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        const result = await signup(value);

        return res.status(201).json({
            success: true,
            message: "OTP generated successfully",
            data: {
                user_id: result.userId,
                otp: result.otp
            }
        });
    } catch (error) {
        if (
            error.code === "PHONE_ALREADY_REGISTERED" ||
            error.code === "ACCOUNT_DELETION_PENDING"
        ) {
            return res.status(409).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const verifyOtpController = async (req, res) => {
    try {
        const { error, value } = validate(
            verifyOtpSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        const result = await verifyOtp(value);

        if (result.purpose === "signup") {
            return res.status(200).json({
                success: true,
                message: "Phone number verified successfully."
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully.",
            data: {
                reset_token: result.resetToken
            }
        });
    } catch (error) {
        const statusCodes = {
            USER_NOT_FOUND: 404,
            ACCOUNT_DELETION_PENDING: 409,
            OTP_NOT_FOUND: 400,
            OTP_EXPIRED: 400,
            INVALID_OTP: 400,
            INVALID_OTP_PURPOSE: 400
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};

export const resendOtpController = async (req, res) => {
    try {
        const { error, value } = validate(
            resendOtpSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        const result = await resendOtp(value);

        return res.status(200).json({
            success: true,
            message: "OTP generated successfully.",
            data: {
                otp: result.otp
            }
        });
    } catch (error) {
        const statusCodes = {
            USER_NOT_FOUND: 404,
            ACCOUNT_DELETION_PENDING: 409,
            PHONE_ALREADY_VERIFIED: 409
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};

export const loginController = async (req, res) => {
    try {
        const { error, value } = validate(
            loginSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        const result = await login(value);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            data: {
                user: result.user,
                access_token: result.accessToken,
                refresh_token: result.refreshToken
            }
        });
    } catch (error) {
        const statusCodes = {
            INVALID_CREDENTIALS: 401,
            ACCOUNT_DELETION_PENDING: 409,
            ACCOUNT_DELETION_EXPIRED: 410,
            PHONE_NOT_VERIFIED: 403
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};

export const refreshTokenController = async (req, res) => {
    try {
        const { error, value } = validate(
            refreshTokenSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        const result = await refreshAccessToken(
            value.refresh_token
        );

        return res.status(200).json({
            success: true,
            message: "Access token refreshed successfully.",
            data: {
                access_token: result.accessToken,
                refresh_token: result.refreshToken
            }
        });
    } catch (error) {
        const statusCodes = {
            INVALID_REFRESH_TOKEN: 401,
            USER_NOT_FOUND: 404,
            ACCOUNT_DELETION_PENDING: 409
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};

export const logoutController = async (req, res) => {
    try {
        await logout(req.user.id);

        return res.status(200).json({
            success: true,
            message: "Logout successful."
        });
    } catch (error) {
        if (error.code === "USER_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const forgotPasswordController = async (req, res) => {
    try {
        const { error, value } = validate(
            forgotPasswordSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        const result = await forgotPassword(
            value.phone
        );

        return res.status(200).json({
            success: true,
            message: "OTP generated for password reset.",
            data: {
                otp: result.otp
            }
        });
    } catch (error) {
        const statusCodes = {
            USER_NOT_FOUND: 404,
            ACCOUNT_DELETION_PENDING: 409
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};

export const resetPasswordController = async (req, res) => {
    try {
        const { error, value } = validate(
            resetPasswordSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        await resetPassword(value);

        return res.status(200).json({
            success: true,
            message: "Password reset successfully."
        });
    } catch (error) {
        const statusCodes = {
            INVALID_RESET_TOKEN: 401,
            USER_NOT_FOUND: 404,
            ACCOUNT_DELETION_PENDING: 409
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};

export const deleteAccountController = async (req, res) => {
    try {
        const { error, value } = validate(
            deleteAccountSchema,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(
                    (detail) => detail.message
                )
            });
        }

        await deleteAccount({
            userId: req.user.id,
            password: value.password
        });

        return res.status(200).json({
            success: true,
            message: "Account scheduled for deletion."
        });
    } catch (error) {
        const statusCodes = {
            USER_NOT_FOUND: 404,
            ACCOUNT_DELETION_PENDING: 409,
            INVALID_PASSWORD: 401
        };

        return res.status(
            statusCodes[error.code] || 500
        ).json({
            success: false,
            code: error.code,
            message:
                statusCodes[error.code]
                    ? error.message
                    : "Internal server error"
        });
    }
};