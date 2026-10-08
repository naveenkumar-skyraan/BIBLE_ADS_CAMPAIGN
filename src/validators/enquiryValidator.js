import Joi from "joi";

export const createEnquirySchema = Joi.object({

    name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            "string.empty": "Name is required",
            "string.min": "Name must be at least 2 characters",
            "string.max": "Name must not exceed 100 characters",
            "any.required": "Name is required"
        }),

    phone: Joi.string()
        .trim()
        .pattern(/^\+?[0-9]{7,15}$/)
        .allow(null, "")
        .optional()
        .messages({
            "string.pattern.base": "Please provide a valid phone number"
        }),

    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(255)
        .required()
        .messages({
            "string.empty": "Email address is required",
            "string.email": "Please provide a valid email address",
            "string.max": "Email address must not exceed 255 characters",
            "any.required": "Email address is required"
        }),

    location: Joi.string()
        .trim()
        .min(2)
        .max(255)
        .required()
        .messages({
            "string.empty": "Location is required",
            "string.min": "Location must be at least 2 characters",
            "string.max": "Location must not exceed 255 characters",
            "any.required": "Location is required"
        }),

    business_name: Joi.string()
        .trim()
        .min(2)
        .max(150)
        .required()
        .messages({
            "string.empty": "Business name is required",
            "string.min": "Business name must be at least 2 characters",
            "string.max": "Business name must not exceed 150 characters",
            "any.required": "Business name is required"
        }),

    business_type: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            "string.empty": "Business type is required",
            "string.min": "Business type must be at least 2 characters",
            "string.max": "Business type must not exceed 100 characters",
            "any.required": "Business type is required"
        }),

    enquiry: Joi.string()
        .trim()
        .max(5000)
        .allow("")
        .optional()
        .messages({
            "string.max": "Enquiry must not exceed 5000 characters"
        }),

    is_logged_user: Joi.number()
        .valid(0, 1)
        .required()
        .messages({
            "number.base": "is_logged_user must be a number",
            "any.only": "is_logged_user must be either 0 or 1",
            "any.required": "is_logged_user is required"
        })

});