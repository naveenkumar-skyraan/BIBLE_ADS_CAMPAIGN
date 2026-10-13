const businessDetailSchema = {
  BusinessDetails: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      user_id: { type: "integer", example: 25 },
      name: { type: "string", example: "Naveen Kumar" },
      business_name: { type: "string", example: "Real Estate" },
      email: {
        type: "string",
        nullable: true,
        example: "yourmail@gmail.com",
      },
      country_code: { type: "string", example: "IN" },
      admin_area_1: {
        type: "string",
        nullable: true,
        example: "Tamil Nadu",
      },
      admin_area_2: {
        type: "string",
        nullable: true,
        example: "Coimbatore",
      },
      city: {
        type: "string",
        nullable: true,
        example: "Coimbatore",
      },
      area: {
        type: "string",
        nullable: true,
        example: "Gandhipuram",
      },
      postal_code: {
        type: "string",
        nullable: true,
        example: "641012",
      },
      tax_id: {
        type: "string",
        nullable: true,
        example: "GST123456789",
      },
      tax_id_type: {
        type: "string",
        nullable: true,
        example: "GSTIN",
      },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },

  CreateBusinessRequest: {
    type: "object",
    required: ["name", "business_name", "country_code"],
    properties: {
      name: { type: "string", maxLength: 150, example: "Naveen" },
      business_name: {
        type: "string",
        maxLength: 200,
        example: "Real Estate",
      },
      email: {
        type: "string",
        nullable: true,
        example: "yourmail@gmail.com",
      },
      country_code: { type: "string", example: "IN" },
      admin_area_1: {
        type: "string",
        nullable: true,
        example: "Tamil Nadu",
      },
      admin_area_2: {
        type: "string",
        nullable: true,
        example: "Coimbatore",
      },
      city: { type: "string", nullable: true, example: "Coimbatore" },
      area: { type: "string", nullable: true, example: "Gandhipuram" },
      postal_code: { type: "string", nullable: true, example: "641012" },
      tax_id: { type: "string", nullable: true, example: "GST123456789" },
      tax_id_type: { type: "string", nullable: true, example: "GSTIN" },
    },
  },

  UpdateBusinessRequest: {
    type: "object",
    minProperties: 1,
    properties: {
      name: { type: "string", maxLength: 150 },
      business_name: { type: "string", maxLength: 200 },
      email: { type: "string", nullable: true },
      country_code: { type: "string", example: "IN" },
      admin_area_1: { type: "string", nullable: true },
      admin_area_2: { type: "string", nullable: true },
      city: { type: "string", nullable: true },
      area: { type: "string", nullable: true },
      postal_code: { type: "string", nullable: true },
      tax_id: { type: "string", nullable: true },
      tax_id_type: { type: "string", nullable: true },
    },
  },

  CountryConfigurationResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      count: { type: "integer", example: 1 },
      countries: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
      country: {
        type: "object",
        nullable: true,
        additionalProperties: true,
      },
    },
  },

  LocationSuggestionResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      count: { type: "integer", example: 1 },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            place_id: { type: "string" },
            description: { type: "string" },
            main_text: { type: "string", nullable: true },
            secondary_text: { type: "string", nullable: true },
            types: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },

  PlaceDetailsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      place: {
        type: "object",
        properties: {
          place_id: { type: "string" },
          name: { type: "string", nullable: true },
          formatted_address: { type: "string", nullable: true },
          latitude: { type: "number", nullable: true },
          longitude: { type: "number", nullable: true },
          address: {
            $ref: "#/components/schemas/LocationAddress",
          },
        },
      },
    },
  },

  ReverseGeocodeResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      location: {
        type: "object",
        properties: {
          place_id: { type: "string" },
          formatted_address: { type: "string", nullable: true },
          latitude: { type: "number" },
          longitude: { type: "number" },
          address: {
            $ref: "#/components/schemas/LocationAddress",
          },
        },
      },
    },
  },

  LocationAddress: {
    type: "object",
    properties: {
      country_code: { type: "string", nullable: true },
      admin_area_1: { type: "string", nullable: true },
      admin_area_2: { type: "string", nullable: true },
      city: { type: "string", nullable: true },
      area: { type: "string", nullable: true },
      postal_code: { type: "string", nullable: true },
    },
  },
};

export default businessDetailSchema;
