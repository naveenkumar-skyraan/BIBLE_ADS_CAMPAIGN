
const issueReportSchema = {
  IssueType: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "Campaign Not Running" },
      display_order: { type: "integer", example: 1 },
      is_active: { type: "integer", enum: [0, 1], example: 1 }
    }
  },

  CreateIssueTypeRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", maxLength: 150, example: "Campaign Not Running" },
      display_order: { type: "integer", minimum: 0, example: 1 },
      is_active: { type: "integer", enum: [0, 1], example: 1 }
    }
  },

  UpdateIssueTypeRequest: {
    type: "object",
    required: ["name", "display_order", "is_active"],
    properties: {
      name: { type: "string", maxLength: 150, example: "Campaign Not Running" },
      display_order: { type: "integer", minimum: 0, example: 1 },
      is_active: { type: "integer", enum: [0, 1], example: 1 }
    }
  },

  UpdateIssueTypeStatusRequest: {
    type: "object",
    required: ["is_active"],
    properties: {
      is_active: { type: "integer", enum: [0, 1], example: 0 }
    }
  },

  UpdateReportedIssueStatusRequest: {
    type: "object",
    required: ["status"],
    properties: {
      status: {
        type: "integer",
        enum: [1, 2, 3, 4],
        description: "1 = Pending, 2 = In Progress, 3 = Resolved, 4 = Closed",
        example: 2
      }
    }
  },

  IssueReport: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      user_id: { type: "integer", example: 15 },
      issue_type_id: { type: "integer", example: 1 },
      issue_type: { type: "string", example: "Campaign Not Running" },
      description: {
        type: "string",
        example: "My campaign is active but no ads are being delivered."
      },
      screenshot_path: {
        type: "string",
        nullable: true,
        example: "uploads/issue-reports/123-example.png"
      },
      status: { type: "integer", enum: [1, 2, 3, 4], example: 1 },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" }
    }
  },

  IssueTypesResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string", example: "Issue types fetched successfully" },
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/IssueType" }
      }
    }
  },

  IssueTypeResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string" },
      data: { $ref: "#/components/schemas/IssueType" }
    }
  },

  IssueReportResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string" },
      data: { $ref: "#/components/schemas/IssueReport" }
    }
  },

  IssueReportsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string" },
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/IssueReport" }
      }
    }
  }
};

export default issueReportSchema;
