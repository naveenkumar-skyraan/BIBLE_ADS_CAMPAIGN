import Joi from "joi";

const adAnalyticsBatchSchema = Joi.object({
  batch_id: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required(),

  platform: Joi.string()
    .valid("android", "ios")
    .required(),

  app_instance_id: Joi.string()
    .trim()
    .max(100)
    .allow(null, "")
    .optional(),

  app_version: Joi.string()
    .trim()
    .max(30)
    .allow(null, "")
    .optional(),

  interval_start: Joi.number()
    .integer()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .required(),

  interval_end: Joi.number()
    .integer()
    .greater(Joi.ref("interval_start"))
    .max(Number.MAX_SAFE_INTEGER)
    .required(),

  items: Joi.array()
    .items(
      Joi.object({
        ad_id: Joi.number()
          .integer()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .required(),

        impressions: Joi.number()
          .integer()
          .min(0)
          .max(Number.MAX_SAFE_INTEGER)
          .required(),

        clicks: Joi.number()
          .integer()
          .min(0)
          .max(Number.MAX_SAFE_INTEGER)
          .required(),
      }).required(),
    )
    .min(1)
    .max(500)
    .unique("ad_id")
    .required(),
}).required();

export default adAnalyticsBatchSchema;