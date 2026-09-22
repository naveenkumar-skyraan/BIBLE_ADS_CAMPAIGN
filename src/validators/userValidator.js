import Joi from "joi";

export const signupSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required(),

    phone: Joi.string()
        .trim()
        .pattern(/^[0-9]{10}$/)
        .required(),

    password: Joi.string()
        .min(8)
        .max(128)
        .required()
});

export const verifyOtpSchema = Joi.object({
    phone: Joi.string()
        .trim()
        .pattern(/^[0-9]{10}$/)
        .required(),

    otp: Joi.string()
        .pattern(/^[0-9]{4}$/)
        .required()
});

export const resendOtpSchema = Joi.object({
    phone: Joi.string()
        .trim()
        .pattern(/^[0-9]{10}$/)
        .required(),

    purpose: Joi.string()
        .valid("signup", "forgot_password")
        .required()
});

export const loginSchema = Joi.object({
    phone: Joi.string()
        .trim()
        .pattern(/^[0-9]{10}$/)
        .required(),

    password: Joi.string()
        .required(),

    reactivate: Joi.boolean()
        .default(false)
});

export const refreshTokenSchema = Joi.object({
    refresh_token: Joi.string()
        .required()
});

export const forgotPasswordSchema = Joi.object({
    phone: Joi.string()
        .trim()
        .pattern(/^[0-9]{10}$/)
        .required()
});

export const resetPasswordSchema = Joi.object({
    reset_token: Joi.string()
        .required(),

    password: Joi.string()
        .min(8)
        .max(128)
        .required(),

    confirm_password: Joi.string()
        .valid(Joi.ref("password"))
        .required()
        .messages({
            "any.only": "Passwords do not match."
        })
});

export const deleteAccountSchema = Joi.object({
    password: Joi.string()
        .required()
});