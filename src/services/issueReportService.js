
import * as issueReportModel from "../models/issueReportModel.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const issueReportService = {
  async getIssueTypes() {
    return issueReportModel.getActiveIssueTypes();
  },

  async createReport(userId, data, screenshotPath) {
    if (!userId) {
      throw createError("Authenticated user not found", 401);
    }

    const issueType = await issueReportModel.getActiveIssueTypeById(
      data.issue_type_id
    );

    if (!issueType) {
      throw createError("Invalid or inactive issue type", 400);
    }

    const id = await issueReportModel.createReportedIssue({
      user_id: userId,
      issue_type_id: data.issue_type_id,
      description: data.description.trim(),
      screenshot_path: screenshotPath ?? null
    });

    return { id };
  }
};

export default issueReportService;
