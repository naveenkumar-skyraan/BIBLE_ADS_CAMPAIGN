
import Joi from "joi";

const previewImageUrl = Joi.string()
    .trim()
    .max(500)
    .allow("", null);

export const createAdTypeSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),

    code: Joi.string()
        .trim()
        .lowercase()
        .pattern(/^[a-z0-9_-]+$/)
        .max(50)
        .required(),

    description: Joi.string().allow("", null).optional(),

    preview_image_url: previewImageUrl.optional(),

    sort_order: Joi.number().integer().min(0).default(0),

    is_active: Joi.number().valid(0, 1).default(1)
});

export const updateAdTypeSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),

    code: Joi.string()
        .trim()
        .lowercase()
        .pattern(/^[a-z0-9_-]+$/)
        .max(50)
        .required(),

    description: Joi.string().allow("", null).optional(),

    preview_image_url: previewImageUrl.optional(),

    sort_order: Joi.number().integer().min(0).required(),

    is_active: Joi.number().valid(0, 1).required()
});

export const updateAdTypeStatusSchema = Joi.object({
    is_active: Joi.number().valid(0, 1).required()
});
