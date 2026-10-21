import dotenv from "dotenv";
dotenv.config();

import swaggerJsdoc from "swagger-jsdoc";

import authSchema from "../../swaggerSchemas/authSchema.js";
import enquirySchema from "../../swaggerSchemas/enquirySchema.js";
import businessDetailSchema from "../../swaggerSchemas/businessDetailSchema.js";
import walletSchema from "../../swaggerSchemas/walletSchema.js";
import adSchema from "../../swaggerSchemas/adSchema.js";
import profileSchema from "../../swaggerSchemas/profileSchema.js";
import faqSchema from "../../swaggerSchemas/faqSchema.js";
import issueReportSchema from "../../swaggerSchemas/issueReportSchema.js";

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
        SignupOtpRequest: authSchema.SendSignupOtpRequest,
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
        LoginUserResponse: authSchema.LoginUserResponse,

        CreateEnquiryRequest: enquirySchema.CreateEnquiryRequest,
        EnquiryResponse: enquirySchema.EnquiryResponse,

        BusinessDetails: businessDetailSchema.BusinessDetails,
        CreateBusinessRequest: businessDetailSchema.CreateBusinessRequest,
        UpdateBusinessRequest: businessDetailSchema.UpdateBusinessRequest,
        CountryConfigurationResponse:
          businessDetailSchema.CountryConfigurationResponse,
        LocationSuggestionResponse:
          businessDetailSchema.LocationSuggestionResponse,
        PlaceDetailsResponse: businessDetailSchema.PlaceDetailsResponse,
        ReverseGeocodeResponse: businessDetailSchema.ReverseGeocodeResponse,
        LocationAddress: businessDetailSchema.LocationAddress,

        WalletResponse: walletSchema.WalletResponse,
        GetWalletResponse: walletSchema.GetWalletResponse,
        CreateTopupRequest: walletSchema.CreateTopupRequest,
        VerifyTopupRequest: walletSchema.VerifyTopupRequest,
        AllocateFundRequest: walletSchema.AllocateFundRequest,
        SpendFundRequest: walletSchema.SpendFundRequest,
        AdFundResponse: walletSchema.AdFundResponse,

        AdTypeResponse: adSchema.AdTypeResponse,
        AdObjectiveResponse: adSchema.AdObjectiveResponse,
        AdActionButtonResponse: adSchema.AdActionButtonResponse,
        GetAdTypesResponse: adSchema.GetAdTypesResponse,
        GetAdObjectivesResponse: adSchema.GetAdObjectivesResponse,
        GetAdActionButtonsResponse: adSchema.GetAdActionButtonsResponse,

        UpdateProfileRequest: profileSchema.UpdateProfileRequest,
        ProfileResponse: profileSchema.ProfileResponse,

        FAQCategory: faqSchema.FAQCategory,
        FAQQuestion: faqSchema.FAQQuestion,
        FAQQuestionDetail: faqSchema.FAQQuestionDetail,
        FAQCategoriesResponse: faqSchema.FAQCategoriesResponse,
        FAQQuestionsResponse: faqSchema.FAQQuestionsResponse,
        FAQQuestionDetailResponse: faqSchema.FAQQuestionDetailResponse,

        IssueType: issueReportSchema.IssueType,
        CreateIssueTypeRequest: issueReportSchema.CreateIssueTypeRequest,
        UpdateIssueTypeRequest: issueReportSchema.UpdateIssueTypeRequest,
        UpdateIssueTypeStatusRequest:
          issueReportSchema.UpdateIssueTypeStatusRequest,
        UpdateReportedIssueStatusRequest:
          issueReportSchema.UpdateReportedIssueStatusRequest,
        IssueReport: issueReportSchema.IssueReport,
        IssueTypesResponse: issueReportSchema.IssueTypesResponse,
        IssueTypeResponse: issueReportSchema.IssueTypeResponse,
        IssueReportResponse: issueReportSchema.IssueReportResponse,
        IssueReportsResponse: issueReportSchema.IssueReportsResponse,

        ChangePasswordRequest: {
          type: "object",
          required: ["current_password", "new_password", "confirm_password"],
          properties: {
            current_password: {
              type: "string",
            },
            new_password: {
              type: "string",
              minLength: 8,
              maxLength: 128,
            },
            confirm_password: {
              type: "string",
              minLength: 8,
              maxLength: 128,
            },
          },
        },

        AccountDeletionFeedbackRequest: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: {
              type: "string",
              example: "Advertising costs are too high",
            },
            other_reason: {
              type: "string",
              nullable: true,
              example: "I am moving to another advertising platform.",
            },
          },
        },
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
