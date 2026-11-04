import Joi from "joi";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const saveCampaignSchema = Joi.object({
  daily_budget: Joi.number().min(100).precision(2).required(),

  duration_type: Joi.string()
    .valid("days", "custom_date")
    .required(),

  duration_days: Joi.when("duration_type", {
    is: "days",
    then: Joi.number().integer().min(1).required(),
    otherwise: Joi.forbidden(),
  }),

  start_date: Joi.when("duration_type", {
    is: "custom_date",
    then: Joi.string().pattern(datePattern).required(),
    otherwise: Joi.forbidden(),
  }),

  end_date: Joi.when("duration_type", {
    is: "custom_date",
    then: Joi.string().pattern(datePattern).required(),
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);