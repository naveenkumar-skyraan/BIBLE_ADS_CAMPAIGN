
import Joi from "joi";

const cancellationReasons = [
  "no_longer_needed",
  "goal_achieved",
  "create_new_campaign",
  "poor_performance",
  "change_ad_details",
  "budget_concerns",
  "campaign_issue",
  "other",
];

export const cancelAdSchema = Joi.object({
  reason_code: Joi.string()
    .valid(...cancellationReasons)
    .required(),

  other_reason: Joi.when("reason_code", {
    is: "other",
    then: Joi.string().trim().min(1).max(5000).required(),
    otherwise: Joi.string().allow("", null).optional(),
  }),
}).unknown(false);
