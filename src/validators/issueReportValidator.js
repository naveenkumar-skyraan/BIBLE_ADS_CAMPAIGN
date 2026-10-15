
import Joi from "joi";

export const createIssueReportSchema = Joi.object({
  issue_type_id: Joi.number().integer().positive().required(),
  description: Joi.string().trim().min(1).max(5000).required()
});
