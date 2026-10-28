const adSchema = {
  AdTypeResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 1,
      },
      name: {
        type: "string",
        example: "Image Ad",
      },
      code: {
        type: "string",
        example: "IMAGE",
      },
      description: {
        type: "string",
        nullable: true,
        example: "Engage with a single image.",
      },

      preview_image_url: {
        type: "string",
        nullable: true,
        description:
          "Default preview image URL or public path for this ad type.",
        example: "/uploads/ad-previews/banner.png",
      },

      sort_order: {
        type: "integer",
        example: 1,
      },
      is_active: {
        type: "integer",
        enum: [0, 1],
        example: 1,
      },
    },
  },

  AdObjectiveResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 1,
      },
      name: {
        type: "string",
        example: "Increase Awareness",
      },
      description: {
        type: "string",
        nullable: true,
        example: "Build visibility for your brand or message.",
      },
      sort_order: {
        type: "integer",
        example: 1,
      },
      is_active: {
        type: "integer",
        enum: [0, 1],
        example: 1,
      },
      created_at: {
        type: "string",
        format: "date-time",
      },
      updated_at: {
        type: "string",
        format: "date-time",
      },
    },
  },

  AdActionButtonResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 1,
      },
      name: {
        type: "string",
        example: "Learn More",
      },
      code: {
        type: "string",
        example: "LEARN_MORE",
      },
      sort_order: {
        type: "integer",
        example: 1,
      },
      is_active: {
        type: "integer",
        enum: [0, 1],
        example: 1,
      },
      created_at: {
        type: "string",
        format: "date-time",
      },
      updated_at: {
        type: "string",
        format: "date-time",
      },
    },
  },

  GetAdTypesResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/AdTypeResponse",
        },
      },
    },
  },

  GetAdObjectivesResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/AdObjectiveResponse",
        },
      },
    },
  },

  GetAdActionButtonsResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/AdActionButtonResponse",
        },
      },
    },
  },
};

export default adSchema;
