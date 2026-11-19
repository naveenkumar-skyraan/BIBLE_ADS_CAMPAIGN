const adSchema = {
  AdSubtypeResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 1,
      },
      ad_type_id: {
        type: "integer",
        example: 1,
      },
      name: {
        type: "string",
        example: "Single Image",
      },
      code: {
        type: "string",
        example: "SINGLE_IMAGE",
      },
      description: {
        type: "string",
        nullable: true,
        example: "Advertisement using a single image.",
      },
      preview_image_url: {
        type: "string",
        nullable: true,
        example: "/uploads/ad-previews/single-image.png",
      },
      preview_description: {
        type: "string",
        nullable: true,
        example: "Preview of the single image ad subtype.",
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
      preview_description: {
        type: "string",
        nullable: true,
        description: "Preview description for the ad type.",
        example: "Preview of the selected ad type.",
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
      sub_types: {
        type: "array",
        description:
          "Active subtypes belonging to this ad type. Empty when no subtypes are available.",
        items: {
          $ref: "#/components/schemas/AdSubtypeResponse",
        },
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

  AdResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 15,
      },
      campaign_id: {
        type: "integer",
        nullable: true,
        example: 15,
        description: "Internal numeric campaign foreign key.",
      },
      campaign_code: {
        type: "string",
        nullable: true,
        example: "CMP-48276193",
        description: "Stable, non-sequential public campaign identifier.",
      },
      business_id: {
        type: "integer",
        example: 1,
      },
      objective_id: {
        type: "integer",
        example: 1,
      },
      ad_type_id: {
        type: "integer",
        example: 1,
      },
      ad_subtype_id: {
        type: "integer",
        nullable: true,
        description:
          "Optional when the selected ad type has no active subtypes. Required when the selected ad type has active subtypes, and must belong to that ad type. Omit this field when no subtype is available.",
        example: 1,
      },
      title: {
        type: "string",
        example: "Youth meeting",
      },
      description: {
        type: "string",
        example: "Join us for an exciting youth meeting.",
      },
      action_button_type_id: {
        type: "integer",
        nullable: true,
        example: 1,
      },
      destination_link: {
        type: "string",
        nullable: true,
        example: "https://example.com/reading",
      },
      platform: {
        type: "string",
        enum: ["android", "ios", "both"],
        example: "both",
      },
      status: {
        type: "string",
        example: "draft",
      },
      is_cancelled: {
        type: "integer",
        enum: [0, 1],
        description: "1 when the advertisement has been cancelled; otherwise 0.",
        example: 0,
      },
      blocked_at: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "UTC date and time when the current moderation block/rejection began.",
      },
      blocked_at_timestamp: {
        type: "integer",
        format: "int64",
        nullable: true,
        description: "Unix timestamp in seconds for blocked_at.",
      },
      media_id: {
        type: "integer",
        nullable: true,
        example: 12,
      },
      media_type: {
        type: "string",
        nullable: true,
        enum: ["image", "video"],
        example: "image",
      },
      file_url: {
        type: "string",
        nullable: true,
        example: "/uploads/ads/example.jpg",
      },
      file_name: {
        type: "string",
        nullable: true,
        example: "example.jpg",
      },
      mime_type: {
        type: "string",
        nullable: true,
        example: "image/jpeg",
      },
      file_size: {
        type: "integer",
        nullable: true,
        example: 245678,
      },
    },
  },

  AdSingleResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Draft ad created successfully.",
      },
      data: {
        $ref: "#/components/schemas/AdResponse",
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


  CancelAdRequest: {
    type: "object",
    required: ["reason_id"],
    properties: {
      reason_id: {
        type: "integer",
        format: "int64",
        minimum: 1,
        description: "ID of an active cancellation reason returned by GET /api/ads/cancellation-reasons.",
        example: 6,
      },
      other_reason: {
        type: "string",
        minLength: 1,
        maxLength: 5000,
        nullable: true,
        description: "Required when the selected cancellation reason has requires_other=1.",
        example: "I need to change the campaign strategy.",
      },
    },
  },

  GetAdCancellationReasonsResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Cancellation reasons fetched successfully.",
      },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              format: "int64",
              example: 1,
            },
            reason_text: {
              type: "string",
              example: "Campaign is no longer needed",
            },
            requires_other: {
              type: "integer",
              enum: [0, 1],
              example: 0,
            },
          },
        },
      },
    },
  },
};

export default adSchema;