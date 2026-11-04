import Joi from "joi";

export const getAllAdminBusinessesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(10),

  search: Joi.string().allow("").trim().optional(),

  verification_status: Joi.string()
    .valid("pending", "contacted", "approved-closed", "rejected-closed")
    .allow(null, "")
    .optional(),
});

export const adminBusinessIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const updateBusinessVerificationStatusSchema = Joi.object({
  verification_status: Joi.string()
    .valid("contacted", "approved-closed", "rejected-closed")
    .required(),
});

export const updateAdminBusinessDetailsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),

  business_name: Joi.string().trim().min(2).max(200),

  email: Joi.string().email().max(255).allow("", null),

  country_code: Joi.string().trim().max(10),

  admin_area_1: Joi.string().trim().max(150).allow("", null),

  admin_area_2: Joi.string().trim().max(150).allow("", null),

  city: Joi.string().trim().max(150).allow("", null),

  area: Joi.string().trim().max(150).allow("", null),

  postal_code: Joi.string().trim().max(30).allow("", null),

  tax_id: Joi.string().trim().max(100).allow("", null),
})
  .min(1)
  .unknown(false);
