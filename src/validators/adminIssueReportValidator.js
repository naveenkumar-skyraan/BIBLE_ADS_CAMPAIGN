
import Joi from "joi";

export const createIssueTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  display_order: Joi.number().integer().min(0).default(0),
  is_active: Joi.number().integer().valid(0, 1).default(1)
});

export const updateIssueTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  display_order: Joi.number().integer().min(0).required(),
  is_active: Joi.number().integer().valid(0, 1).required()
});

export const updateIssueTypeStatusSchema = Joi.object({
  is_active: Joi.number().integer().valid(0, 1).required()
});

export const updateReportedIssueStatusSchema = Joi.object({
  status: Joi.number().integer().valid(1, 2, 3, 4).required()
});

export const issueReportFiltersSchema = Joi.object({
  status: Joi.number().integer().valid(1, 2, 3, 4).optional(),
  issue_type_id: Joi.number().integer().positive().optional()
});
