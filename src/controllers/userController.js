import {
  signup,
  verifyEmail,
  resendEmailOtp,
  verifyOtp,
  resendOtp,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  deleteAccount,
  changePassword,
  submitAccountDeletionFeedback,
} from "../services/userService.js";

import {
  signupSchema,
  verifyEmailSchema,
  resendEmailOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  accountDeletionFeedbackSchema,
} from "../validators/userValidator.js";

const validate = (schema, body) => {
  return schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
};

export const signupController = async (req, res) => {
  try {
    const { error, value } = validate(signupSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await signup(value);

    return res.status(201).json({
      success: true,
      message: "Signup completed successfully.",
      data: {
        user: result.user,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      },
    });
  } catch (error) {
    const statusCodes = {
      EMAIL_ALREADY_REGISTERED: 409,
      PHONE_ALREADY_REGISTERED: 409,
      ACCOUNT_DELETION_PENDING: 409,
      EMAIL_NOT_VERIFIED: 403,
      PHONE_NOT_VERIFIED: 403,
      PHONE_VERIFICATION_MISMATCH: 400,
      SIGNUP_COMPLETION_FAILED: 409,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const verifyEmailController = async (req, res) => {
  try {
    const { error, value } = validate(verifyEmailSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await verifyEmail(value);

    if (result.purpose === "forgot_password") {
      return res.status(200).json({
        success: true,
        message: "Email OTP verified successfully.",
        data: {
          reset_token: result.resetToken,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. Please verify your phone number.",
      data: {
        email_verified: result.emailVerified,
        phone_verified: result.phoneVerified,
        signup_completed: false,
      },
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
      INVALID_EMAIL_OTP: 400,
      EMAIL_OTP_NOT_FOUND: 400,
      EMAIL_OTP_EXPIRED: 400,
      EMAIL_VERIFICATION_FAILED: 400,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const resendEmailOtpController = async (req, res) => {
  try {
    const { error, value } = validate(resendEmailOtpSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await resendEmailOtp(value);

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email.",
      data: {
        ...(result.otp ? { otp: result.otp } : {}),
      },
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
      EMAIL_ALREADY_VERIFIED: 409,
      EMAIL_ALREADY_REGISTERED: 409,
      PASSWORD_RESET_UNAVAILABLE: 400,
      EMAIL_OTP_UPDATE_FAILED: 409,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const verifyOtpController = async (req, res) => {
  try {
    const { error, value } = validate(verifyOtpSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await verifyOtp({
      ...value,
      userId: value.purpose === "profile" ? req.user?.id : undefined,
    });

    if (result.purpose === "signup") {
      return res.status(200).json({
        success: true,
        message: "Phone number verified successfully.",
      });
    }

    if (result.purpose === "profile") {
      return res.status(200).json({
        success: true,
        message: "Phone number verified successfully.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
      data: {
        reset_token: result.resetToken,
      },
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
      OTP_NOT_FOUND: 400,
      OTP_EXPIRED: 400,
      INVALID_OTP: 400,
      INVALID_OTP_PURPOSE: 400,
      PROFILE_PHONE_NOT_ALLOWED: 403,
      AUTHENTICATION_REQUIRED: 401,
      PHONE_VERIFICATION_MISMATCH: 400,
      PHONE_ALREADY_VERIFIED: 409,
      EMAIL_NOT_VERIFIED: 403,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const resendOtpController = async (req, res) => {
  try {
    const { error, value } = validate(resendOtpSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await resendOtp({
      ...value,
      userId: value.purpose === "profile" ? req.user?.id : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "OTP generated successfully.",
      data: {
        ...(process.env.STATIC_OTP?.trim().toLowerCase() === "true"
          ? { otp: result.otp }
          : {}),
      },
    });
  } catch (error) {
        const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
      PHONE_ALREADY_VERIFIED: 409,
      PHONE_ALREADY_REGISTERED: 409,
      PROFILE_PHONE_NOT_ALLOWED: 403,
      AUTHENTICATION_REQUIRED: 401,
      EMAIL_REQUIRED: 400,
      EMAIL_NOT_VERIFIED: 403,
      EMAIL_ALREADY_REGISTERED: 409,
      SIGNUP_UPDATE_FAILED: 409,
      PHONE_UPDATE_FAILED: 409,
      INVALID_OTP_PURPOSE: 400,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const loginController = async (req, res) => {
  try {
    const { error, value } = validate(loginSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await login(value);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: result.user,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      },
    });
  } catch (error) {
    const statusCodes = {
      INVALID_CREDENTIALS: 401,
      ACCOUNT_DELETION_PENDING: 409,
      ACCOUNT_DELETION_EXPIRED: 410,
      EMAIL_NOT_VERIFIED: 403,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const refreshTokenController = async (req, res) => {
  try {
    const { error, value } = validate(refreshTokenSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await refreshAccessToken(value.refresh_token);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully.",
      data: {
        access_token: result.accessToken,
      },
    });
  } catch (error) {
    const statusCodes = {
      INVALID_REFRESH_TOKEN: 401,
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const logoutController = async (req, res) => {
  try {
    await logout(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
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
      message: "Internal server error",
    });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const { error, value } = validate(forgotPasswordSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await forgotPassword(value.email);
    return res.status(200).json({
      success: true,
      message: "Password reset verification code sent to your email.",
      data: {
        ...(process.env.STATIC_OTP?.trim().toLowerCase() === "true"
          ? { otp: result.otp }
          : {}),
      },
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
      PASSWORD_RESET_UNAVAILABLE: 400,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const { error, value } = validate(resetPasswordSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    await resetPassword(value);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    const statusCodes = {
      INVALID_RESET_TOKEN: 401,
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const deleteAccountController = async (req, res) => {
  try {
    await deleteAccount({
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Account scheduled for deletion.",
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const changePasswordController = async (req, res) => {
  try {
    const { error, value } = validate(changePasswordSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    await changePassword({
      userId: req.user.id,
      currentPassword: value.current_password,
      newPassword: value.new_password,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
      INVALID_CURRENT_PASSWORD: 401,
      PASSWORD_UNCHANGED: 400,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};

export const accountDeletionFeedbackController = async (req, res) => {
  try {
    const { error, value } = validate(accountDeletionFeedbackSchema, req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const result = await submitAccountDeletionFeedback({
      userId: req.user.id,
      reason: value.reason,
      other_reason: value.other_reason,
    });

    return res.status(201).json({
      success: true,
      message: "Account deletion feedback submitted successfully.",
      data: {
        feedback_id: result.feedbackId,
      },
    });
  } catch (error) {
    const statusCodes = {
      USER_NOT_FOUND: 404,
      ACCOUNT_DELETION_PENDING: 409,
    };

    return res.status(statusCodes[error.code] || 500).json({
      success: false,
      code: error.code,
      message: statusCodes[error.code]
        ? error.message
        : "Internal server error",
    });
  }
};
