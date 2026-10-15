
import * as adminIssueReportModel from "../models/adminIssueReportModel.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const issueStatuses = [1, 2, 3, 4];

const adminIssueReportService = {
  async createIssueType(data) {
    const name = data.name.trim();

    const existingTypes = await adminIssueReportModel.getAllIssueTypes();

    if (existingTypes.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw createError("Issue type already exists", 409);
    }

    return {
      id: await adminIssueReportModel.createIssueType({
        ...data,
        name
      })
    };
  },

  async getAllIssueTypes() {
    return adminIssueReportModel.getAllIssueTypes();
  },

  async getIssueTypeById(id) {
    const issueType = await adminIssueReportModel.getIssueTypeById(id);

    if (!issueType) {
      throw createError("Issue type not found", 404);
    }

    return issueType;
  },

  async updateIssueType(id, data) {
    await this.getIssueTypeById(id);

    const name = data.name.trim();
    const existingTypes = await adminIssueReportModel.getAllIssueTypes();

    if (existingTypes.some(
      (item) => Number(item.id) !== Number(id) &&
        item.name.toLowerCase() === name.toLowerCase()
    )) {
      throw createError("Issue type already exists", 409);
    }

    await adminIssueReportModel.updateIssueType(id, {
      ...data,
      name
    });

    return this.getIssueTypeById(id);
  },

  async updateIssueTypeStatus(id, isActive) {
    await this.getIssueTypeById(id);
    await adminIssueReportModel.updateIssueTypeStatus(id, isActive);
    return this.getIssueTypeById(id);
  },

  async deleteIssueType(id) {
    await this.getIssueTypeById(id);
    await adminIssueReportModel.deleteIssueType(id);
    return { id: Number(id) };
  },

  async getAllReportedIssues(filters) {
    if (filters.status !== undefined && !issueStatuses.includes(Number(filters.status))) {
      throw createError("Invalid report status", 400);
    }

    return adminIssueReportModel.getAllReportedIssues({
      ...filters,
      status: filters.status === undefined ? undefined : Number(filters.status),
      issue_type_id: filters.issue_type_id === undefined
        ? undefined
        : Number(filters.issue_type_id)
    });
  },

  async getReportedIssueById(id) {
    const report = await adminIssueReportModel.getReportedIssueById(id);

    if (!report) {
      throw createError("Issue report not found", 404);
    }

    return report;
  },

  async updateReportedIssueStatus(id, status) {
    if (!issueStatuses.includes(Number(status))) {
      throw createError("Invalid report status. Allowed values: 1, 2, 3, 4", 400);
    }

    await this.getReportedIssueById(id);

    await adminIssueReportModel.updateReportedIssueStatus(id, Number(status));

    return this.getReportedIssueById(id);
  },

  async deleteReportedIssue(id) {
    await this.getReportedIssueById(id);
    await adminIssueReportModel.deleteReportedIssue(id);
    return { id: Number(id) };
  }
};

export default adminIssueReportService;
