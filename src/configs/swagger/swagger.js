import dotenv from "dotenv";
dotenv.config();

import swaggerJsdoc from "swagger-jsdoc";

import authSchema from "../../swaggerSchemas/authSchema.js";
import enquirySchema from "../../swaggerSchemas/enquirySchema.js";
import walletSchema from "../../swaggerSchemas/walletSchema.js";

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Bible Ads Campaign API",
      version: "1.0.0",
    },

    servers: [
      {
        url: process.env.SWAGGER_API_BASE,
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },

      schemas: {
        SignupRequest: authSchema.SignupRequest,

        VerifyOtpRequest: authSchema.VerifyOtpRequest,

        ResendOtpRequest: authSchema.ResendOtpRequest,

        LoginRequest: authSchema.LoginRequest,

        RefreshTokenRequest: authSchema.RefreshTokenRequest,

        ForgotPasswordRequest: authSchema.ForgotPasswordRequest,

        ResetPasswordRequest: authSchema.ResetPasswordRequest,

        DeleteAccountRequest: authSchema.DeleteAccountRequest,

        SuccessResponse: authSchema.SuccessResponse,

        ErrorResponse: authSchema.ErrorResponse,

        CreateEnquiryRequest: enquirySchema.CreateEnquiryRequest,

        EnquiryResponse: enquirySchema.EnquiryResponse,

        WalletResponse: walletSchema.WalletResponse,

        GetWalletResponse: walletSchema.GetWalletResponse,

        CreateTopupRequest: walletSchema.CreateTopupRequest,

        VerifyTopupRequest: walletSchema.VerifyTopupRequest,

        AllocateFundRequest: walletSchema.AllocateFundRequest,

        SpendFundRequest: walletSchema.SpendFundRequest,

        AdFundResponse: walletSchema.AdFundResponse,
      },
    },

    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  apis: ["./src/routes/**/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
