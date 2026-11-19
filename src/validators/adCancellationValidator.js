import Joi from "joi";

export const cancelAdSchema = Joi.object({
  reason_id: Joi.number().integer().positive().required(),
  other_reason: Joi.string().trim().min(1).max(5000).allow(null).optional(),
}).unknown(false);

export const deleteAdSchema = Joi.object({
  // Optional legacy fields are accepted for backward compatibility but ignored
  // by deletion. Deleting an active advertisement never requires a reason.
  reason_id: Joi.number().integer().positive().optional(),
  other_reason: Joi.string().trim().max(5000).allow("", null).optional(),
}).unknown(false);
