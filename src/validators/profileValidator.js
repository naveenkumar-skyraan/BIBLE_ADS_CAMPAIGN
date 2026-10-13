import Joi from "joi";

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),

  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required(),

  email: Joi.string().trim().email().max(255).allow("", null).optional(),
});
