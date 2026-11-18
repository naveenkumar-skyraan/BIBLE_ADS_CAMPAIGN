import Joi from "joi";

export const cancelAdSchema = Joi.object({
  reason_id: Joi.number().integer().positive().required(),
  other_reason: Joi.string().trim().min(1).max(5000).allow(null).optional(),
}).unknown(false);
