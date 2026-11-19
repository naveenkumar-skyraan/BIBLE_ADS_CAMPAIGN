import Joi from "joi";

const unsignedId = Joi.number().integer().min(1).max(4294967295);

const dateTimeSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  .required()
  .messages({
    "string.pattern.base": "Date must be in YYYY-MM-DD HH:mm:ss format",
    "string.empty": "Date is required",
    "any.required": "Date is required",
  });

const pricingRuleFields = {
  objective_id: unsignedId.allow(null).required(),

  ad_type_id: unsignedId.allow(null).required(),

  ad_subtype_id: unsignedId.allow(null).optional(),

  billing_model: Joi.string().valid("cpm", "cpc").required(),

  country_code: Joi.string().length(2).uppercase().allow(null).required(),

  admin_area_1: Joi.string().max(150).allow(null, "").optional(),

  city: Joi.string().max(150).allow(null, "").optional(),

  platform: Joi.string().valid("all", "android", "ios").required(),

  currency_code: Joi.string().valid("USD").required().messages({ "any.only": "Campaign pricing rules must be entered in USD, the base reference currency." }),

  rate: Joi.number().positive().max(999999999999.999999).precision(6).required(),

  effective_from: dateTimeSchema,

  effective_until: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .allow(null)
    .optional()
    .messages({
      "string.pattern.base":
        "Effective until must be in YYYY-MM-DD HH:mm:ss format",
    }),
};

const validateEffectiveDates = (value, helpers) => {
  if (value.effective_until && value.effective_until <= value.effective_from) {
    return helpers.error("any.invalid", {
      message: "Effective until must be later than effective from",
    });
  }

  return value;
};

export const createPricingRuleSchema = Joi.object({
  ...pricingRuleFields,

  is_active: Joi.number().valid(0, 1).default(1),
}).custom(validateEffectiveDates);

export const updatePricingRuleSchema = Joi.object({
  ...pricingRuleFields,

  effective_until: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .allow(null)
    .required(),
}).custom(validateEffectiveDates);

export const listPricingRulesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(10),

  search: Joi.string().trim().max(150).allow("", null).optional(),

  objective_id: unsignedId.allow(null).optional(),

  ad_type_id: unsignedId.allow(null).optional(),

  ad_subtype_id: unsignedId.allow(null).optional(),

  billing_model: Joi.string().valid("cpm", "cpc").allow(null).optional(),

  country_code: Joi.string().length(2).uppercase().allow(null).optional(),

  admin_area_1: Joi.string().max(150).allow("", null).optional(),

  city: Joi.string().max(150).allow("", null).optional(),

  platform: Joi.string().valid("all", "android", "ios").allow(null).optional(),

  currency_code: Joi.string().length(3).uppercase().allow(null).optional(),

  is_active: Joi.number().valid(0, 1).allow(null).optional(),
});

export const pricingRuleIdSchema = Joi.object({
  id: unsignedId.required(),
});

export const updatePricingRuleStatusSchema = Joi.object({
  is_active: Joi.number().valid(0, 1).required(),
});
