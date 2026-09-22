const authSchema = {
    SignupRequest: {
        type: "object",
        required: ["name", "phone", "password"],
        properties: {
            name: {
                type: "string",
                example: "Naveen Kumar"
            },
            phone: {
                type: "string",
                example: "9876543210"
            },
            password: {
                type: "string",
                format: "password",
                example: "Password@123"
            }
        }
    },

    VerifyOtpRequest: {
        type: "object",
        required: ["phone", "otp"],
        properties: {
            phone: {
                type: "string",
                example: "9876543210"
            },
            otp: {
                type: "string",
                example: "1234"
            }
        }
    },

    ResendOtpRequest: {
        type: "object",
        required: ["phone", "purpose"],
        properties: {
            phone: {
                type: "string",
                example: "9876543210"
            },
            purpose: {
                type: "string",
                enum: ["signup", "forgot_password"],
                example: "signup"
            }
        }
    },

    LoginRequest: {
        type: "object",
        required: ["phone", "password"],
        properties: {
            phone: {
                type: "string",
                example: "9876543210"
            },
            password: {
                type: "string",
                format: "password",
                example: "Password@123"
            },
            reactivate: {
                type: "boolean",
                example: false
            }
        }
    },

    RefreshTokenRequest: {
        type: "object",
        required: ["refresh_token"],
        properties: {
            refresh_token: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIs..."
            }
        }
    },

    ForgotPasswordRequest: {
        type: "object",
        required: ["phone"],
        properties: {
            phone: {
                type: "string",
                example: "9876543210"
            }
        }
    },

    ResetPasswordRequest: {
        type: "object",
        required: [
            "reset_token",
            "password",
            "confirm_password"
        ],
        properties: {
            reset_token: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIs..."
            },
            password: {
                type: "string",
                format: "password",
                example: "NewPassword@123"
            },
            confirm_password: {
                type: "string",
                format: "password",
                example: "NewPassword@123"
            }
        }
    },

    DeleteAccountRequest: {
        type: "object",
        required: ["password"],
        properties: {
            password: {
                type: "string",
                format: "password",
                example: "Password@123"
            }
        }
    },

    SuccessResponse: {
        type: "object",
        properties: {
            success: {
                type: "boolean",
                example: true
            },
            message: {
                type: "string",
                example: "Request successful."
            },
            data: {
                type: "object",
                additionalProperties: true
            }
        }
    },

    ErrorResponse: {
        type: "object",
        properties: {
            success: {
                type: "boolean",
                example: false
            },
            code: {
                type: "string",
                example: "INVALID_CREDENTIALS"
            },
            message: {
                type: "string",
                example: "Invalid credentials."
            }
        }
    }
};

export default authSchema;