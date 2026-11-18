import Joi from "joi";

export const cancelAdSchema = Joi.object({
  reason_id: Joi.number().integer().positive().required(),
  other_reason: Joi.string().trim().min(1).max(5000).allow(null).optional(),
}).unknown(false);


// Optional feedback for the common DELETE endpoint. Active campaigns require
// reason_id; non-active ads may be deleted without a reason.
export const deleteAdSchema = Joi.object({
  reason_id: Joi.number().integer().positive().optional(),
  other_reason: Joi.string().trim().min(1).max(5000).allow(null).optional(),
}).unknown(false);
