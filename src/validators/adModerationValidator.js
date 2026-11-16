import Joi from "joi";

export const submitAdForReviewSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(255).required(),

  update_reason: Joi.string().trim().min(1).max(5000).required(),
}).unknown(false);