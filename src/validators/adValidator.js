import Joi from "joi";

const baseFields = {
    business_id: Joi.number().integer().positive(),
    objective_id: Joi.number().integer().positive(),

    title: Joi.string().trim().min(1).max(100),

    description: Joi.string().trim().min(1).max(500),

    ad_type_id: Joi.number().integer().positive(),

    action_button_type_id: Joi.number().integer().positive().allow(null),

    destination_link: Joi.string()
        .trim()
        .max(2048)
        .allow("", null),

    platform: Joi.string().valid("android", "ios", "both"),
};

export const createAdSchema = Joi.object({
    ...baseFields,

    business_id: baseFields.business_id.required(),
    objective_id: baseFields.objective_id.required(),
    title: baseFields.title.required(),
    description: baseFields.description.required(),
    ad_type_id: baseFields.ad_type_id.required(),
    platform: baseFields.platform.required(),
})
    .unknown(false);

export const updateAdSchema = Joi.object(baseFields)
    .min(1)
    .unknown(false);