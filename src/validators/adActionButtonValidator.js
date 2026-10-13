import Joi from "joi";

export const createAdActionButtonValidator = Joi.object({
    name: Joi.string()
        .trim()
        .max(100)
        .required(),

    code: Joi.string()
        .trim()
        .max(50)
        .pattern(/^[A-Z0-9_]+$/)
        .required(),

    sort_order: Joi.number()
        .integer()
        .min(0)
        .required(),

    is_active: Joi.number()
        .integer()
        .valid(0, 1)
        .required()
});

export const updateAdActionButtonValidator = Joi.object({
    name: Joi.string()
        .trim()
        .max(100)
        .required(),

    code: Joi.string()
        .trim()
        .max(50)
        .pattern(/^[A-Z0-9_]+$/)
        .required(),

    sort_order: Joi.number()
        .integer()
        .min(0)
        .required(),

    is_active: Joi.number()
        .integer()
        .valid(0, 1)
        .required()
});

export const updateAdActionButtonStatusValidator = Joi.object({
    is_active: Joi.number()
        .integer()
        .valid(0, 1)
        .required()
});