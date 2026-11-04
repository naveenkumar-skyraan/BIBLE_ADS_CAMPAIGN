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

export const adminProfileUpdateSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required()
        .messages({
            "string.empty": "Name is required",
            "string.min": "Name must be at least 2 characters",
            "string.max": "Name must not exceed 50 characters",
            "any.required": "Name is required"
        }),

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

    changePassword: Joi.boolean()
        .truthy("true")
        .falsy("false")
        .default(false),

    oldPassword: Joi.when("changePassword", {
        is: true,
        then: Joi.string()
            .min(8)
            .max(255)
            .required()
            .messages({
                "string.empty": "Current password is required",
                "any.required": "Current password is required"
            }),
        otherwise: Joi.string().allow("").optional()
    }),

    newPassword: Joi.when("changePassword", {
        is: true,
        then: Joi.string()
            .min(8)
            .max(255)
            .required()
            .messages({
                "string.empty": "New password is required",
                "string.min": "New password must be at least 8 characters",
                "string.max": "New password must not exceed 255 characters",
                "any.required": "New password is required"
            }),
        otherwise: Joi.string().allow("").optional()
    }),

    confirmNewPassword: Joi.when("changePassword", {
        is: true,
        then: Joi.string()
            .valid(Joi.ref("newPassword"))
            .required()
            .messages({
                "any.only": "New password and confirmation password do not match",
                "any.required": "Please confirm your new password"
            }),
        otherwise: Joi.string().allow("").optional()
    })
});