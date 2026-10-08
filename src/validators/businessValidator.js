import Joi from "joi";

export const createBusinessSchema = Joi.object({
    name: Joi.string().trim().max(150).required(),

    business_name: Joi.string().trim().max(200).required(),

    email: Joi.string().trim().email().max(255).allow(null, ""),

    country_code: Joi.string().trim().max(10).required(),

    admin_area_1: Joi.string().trim().max(150).allow(null, ""),

    admin_area_2: Joi.string().trim().max(150).allow(null, ""),

    city: Joi.string().trim().max(150).allow(null, ""),

    area: Joi.string().trim().max(200).allow(null, ""),

    postal_code: Joi.string().trim().max(30).allow(null, ""),

    tax_id: Joi.string().trim().max(100).allow(null, ""),

    tax_id_type: Joi.string().trim().max(50).allow(null, "")
});