import Joi from "joi";

export const createAdObjectiveSchema = Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    description: Joi.string().allow("", null).optional(),
    sort_order: Joi.number().integer().min(0).default(0),
    is_active: Joi.number().valid(0, 1).default(1)
});

export const updateAdObjectiveSchema = Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    description: Joi.string().allow("", null).optional(),
    sort_order: Joi.number().integer().min(0).required(),
    is_active: Joi.number().valid(0, 1).required()
});

export const updateAdObjectiveStatusSchema = Joi.object({
    is_active: Joi.number().valid(0, 1).required()
});