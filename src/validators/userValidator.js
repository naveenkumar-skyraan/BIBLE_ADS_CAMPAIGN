import Joi from "joi";

export const signupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().max(255).lowercase().required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required(),
  password: Joi.string().min(8).max(128).required(),
});

export const verifyEmailSchema = Joi.object({
  email: Joi.string().trim().email().max(255).lowercase().required(),
  otp: Joi.string()
    .trim()
    .pattern(/^[0-9]{4,6}$/)
    .required(),
  purpose: Joi.string().valid("signup", "forgot_password").required(),
});

export const resendEmailOtpSchema = Joi.object({
  email: Joi.string().trim().email().max(255).lowercase().required(),
  purpose: Joi.string().valid("signup", "forgot_password").required(),
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required(),
  otp: Joi.string()
    .trim()
    .pattern(/^[0-9]{4,6}$/)
    .required(),
  purpose: Joi.string().valid("signup", "profile").required(),
});

export const resendOtpSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required(),
  email: Joi.when("purpose", {
    is: "signup",
    then: Joi.string().trim().email().max(255).lowercase().required(),
    otherwise: Joi.string().trim().email().max(255).lowercase().optional(),
  }),
  purpose: Joi.string().valid("signup", "profile").required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(255).lowercase().required(),
  password: Joi.string().required(),
  reactivate: Joi.boolean().default(false),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().max(255).lowercase().required(),
});

export const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

export const resetPasswordSchema = Joi.object({
  reset_token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required(),
  confirm_password: Joi.string()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Passwords do not match.",
    }),
});

export const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).max(128).required(),
  confirm_password: Joi.string()
    .valid(Joi.ref("new_password"))
    .required()
    .messages({
      "any.only": "Passwords do not match.",
    }),
});

export const accountDeletionFeedbackSchema = Joi.object({
  reason: Joi.string().required(),
  other_reason: Joi.string().allow(null, "").optional(),
});
