import Joi from "joi";

const dashboardBodySchema = Joi.object({
  business_id: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER),
  overview_period: Joi.string()
    .valid("this_month", "this_year", "this_week", "last_month", "last_year")
    .default("this_month"),
  spend_period: Joi.string()
    .valid("this_month", "this_year", "this_week", "last_month", "last_year")
    .default("this_year"),
  timezone: Joi.string().trim().min(1).max(64).default("Asia/Kolkata"),
  top_limit: Joi.number().integer().min(1).max(10).default(5),
}).unknown(false);

export default dashboardBodySchema;
