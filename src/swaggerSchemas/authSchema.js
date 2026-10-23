const authSchema = {
  SignupRequest: {
    type: "object",
    required: ["name", "email", "phone", "password"],
    properties: {
      name: {
        type: "string",
        example: "Naveen Kumar",
      },
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
      },
      phone: {
        type: "string",
        pattern: "^[0-9]{10}$",
        example: "9876543210",
      },
      password: {
        type: "string",
        format: "password",
        example: "Password@123",
      },
    },
  },

  VerifyEmailRequest: {
    type: "object",
    required: ["email", "otp", "purpose"],
    properties: {
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
      },
      otp: {
        type: "string",
        example: "1234",
      },
      purpose: {
        type: "string",
        enum: ["signup", "forgot_password"],
        example: "signup",
      },
    },
  },

  ResendEmailOtpRequest: {
    type: "object",
    required: ["email", "purpose"],
    properties: {
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
      },
      purpose: {
        type: "string",
        enum: ["signup", "forgot_password"],
        example: "signup",
      },
    },
  },

  VerifyOtpRequest: {
    type: "object",
    required: ["phone", "otp", "purpose"],
    properties: {
      phone: {
        type: "string",
        pattern: "^[0-9]{10}$",
        example: "9876543210",
      },
      otp: {
        type: "string",
        pattern: "^[0-9]{4,6}$",
        example: "1234",
      },
      purpose: {
        type: "string",
        enum: ["signup", "profile"],
        example: "signup",
      },
    },
  },

  ResendOtpRequest: {
    type: "object",
    required: ["phone", "purpose"],
    properties: {
      phone: {
        type: "string",
        pattern: "^[0-9]{10}$",
        example: "9876543210",
      },
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
        description:
          "Required when purpose is signup; omitted for profile verification.",
      },
      purpose: {
        type: "string",
        enum: ["signup", "profile"],
        example: "signup",
      },
    },
  },

  LoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
      },
      password: {
        type: "string",
        format: "password",
        example: "Password@123",
      },
      reactivate: {
        type: "boolean",
        example: false,
      },
    },
  },

  RefreshTokenRequest: {
    type: "object",
    required: ["refresh_token"],
    properties: {
      refresh_token: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIs...",
      },
    },
  },

  ForgotPasswordRequest: {
    type: "object",
    required: ["email"],
    properties: {
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
      },
    },
  },

  ResetPasswordRequest: {
    type: "object",
    required: ["reset_token", "password", "confirm_password"],
    properties: {
      reset_token: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIs...",
      },
      password: {
        type: "string",
        format: "password",
        example: "NewPassword@123",
      },
      confirm_password: {
        type: "string",
        format: "password",
        example: "NewPassword@123",
      },
    },
  },

  DeleteAccountRequest: {
    type: "object",
    properties: {},
  },

  ChangePasswordRequest: {
    type: "object",
    required: ["current_password", "new_password", "confirm_password"],
    properties: {
      current_password: {
        type: "string",
        format: "password",
        example: "Password@123",
      },
      new_password: {
        type: "string",
        format: "password",
        example: "NewPassword@123",
      },
      confirm_password: {
        type: "string",
        format: "password",
        example: "NewPassword@123",
      },
    },
  },

  AccountDeletionFeedbackRequest: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        example: "Not using the application anymore",
      },
      other_reason: {
        type: "string",
        example: "",
      },
    },
  },

  LoginUserResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 1,
      },
      name: {
        type: "string",
        example: "Naveen Kumar",
      },
      phone: {
        type: "string",
        nullable: true,
        example: null,
      },
      email: {
        type: "string",
        format: "email",
        example: "user@example.com",
      },
      has_business: {
        type: "integer",
        enum: [0, 1],
        description: "0 = No business, 1 = Business exists",
        example: 0,
      },
    },
  },

  SuccessResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Request successful.",
      },
      data: {
        type: "object",
        additionalProperties: true,
      },
    },
  },

  ErrorResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: false,
      },
      code: {
        type: "string",
        example: "INVALID_CREDENTIALS",
      },
      message: {
        type: "string",
        example: "Invalid credentials.",
      },
    },
  },
};

export default authSchema;
