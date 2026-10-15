
import adminIssueReportService from "../services/adminIssueReportService.js";

const adminIssueReportController = {
  async createIssueType(req, res, next) {
    try {
      const data = await adminIssueReportService.createIssueType(req.body);

      return res.status(201).json({
        success: true,
        message: "Issue type created successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllIssueTypes(req, res, next) {
    try {
      const data = await adminIssueReportService.getAllIssueTypes();

      return res.status(200).json({
        success: true,
        message: "Issue types fetched successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async getIssueTypeById(req, res, next) {
    try {
      const data = await adminIssueReportService.getIssueTypeById(req.params.id);

      return res.status(200).json({
        success: true,
        message: "Issue type fetched successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async updateIssueType(req, res, next) {
    try {
      const data = await adminIssueReportService.updateIssueType(
        req.params.id,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: "Issue type updated successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async updateIssueTypeStatus(req, res, next) {
    try {
      const data = await adminIssueReportService.updateIssueTypeStatus(
        req.params.id,
        req.body.is_active
      );

      return res.status(200).json({
        success: true,
        message: "Issue type status updated successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteIssueType(req, res, next) {
    try {
      const data = await adminIssueReportService.deleteIssueType(req.params.id);

      return res.status(200).json({
        success: true,
        message: "Issue type deleted successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllReportedIssues(req, res, next) {
    try {
      const data = await adminIssueReportService.getAllReportedIssues({
        status: req.query.status,
        issue_type_id: req.query.issue_type_id
      });

      return res.status(200).json({
        success: true,
        message: "Issue reports fetched successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async getReportedIssueById(req, res, next) {
    try {
      const data = await adminIssueReportService.getReportedIssueById(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        message: "Issue report fetched successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async updateReportedIssueStatus(req, res, next) {
    try {
      const data = await adminIssueReportService.updateReportedIssueStatus(
        req.params.id,
        req.body.status
      );

      return res.status(200).json({
        success: true,
        message: "Issue report status updated successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteReportedIssue(req, res, next) {
    try {
      const data = await adminIssueReportService.deleteReportedIssue(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        message: "Issue report deleted successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  }
};

export default adminIssueReportController;
