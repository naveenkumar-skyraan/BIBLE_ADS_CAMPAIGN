import Joi from "joi";

export const adminLoginSchema = Joi.object({
    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(191)
        .required()
        .messages({
            "string.empty": "Email address is required",
            "string.email": "Please provide a valid email address",
            "string.max": "Email address must not exceed 191 characters",
            "any.required": "Email address is required"
        }),

    password: Joi.string()
        .min(8)
        .max(255)
        .required()
        .messages({
            "string.empty": "Password is required",
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password must not exceed 255 characters",
            "any.required": "Password is required"
        })
});