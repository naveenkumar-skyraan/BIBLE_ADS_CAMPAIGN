
import issueReportService from "../services/issueReportService.js";

const issueReportController = {
  async getIssueTypes(req, res, next) {
    try {
      const data = await issueReportService.getIssueTypes();

      return res.status(200).json({
        success: true,
        message: "Issue types fetched successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async createReport(req, res, next) {
    try {
      const result = await issueReportService.createReport(
        req.user?.id,
        req.body,
        req.file?.path
      );

      return res.status(201).json({
        success: true,
        message: "Issue reported successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

export default issueReportController;
