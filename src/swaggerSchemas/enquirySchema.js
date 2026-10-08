const enquirySchema = {
    CreateEnquiryRequest: {
        type: "object",
        required: [
            "name",
            "email",
            "location",
            "business_name",
            "business_type",
            "is_logged_user"
        ],
        properties: {
            name: {
                type: "string",
                example: "Naveen"
            },
            phone: {
                type: "string",
                nullable: true,
                example: "9876543210"
            },
            email: {
                type: "string",
                format: "email",
                example: "youremail@gmail.com"
            },
            location: {
                type: "string",
                example: "Coimbatore, Tamil Nadu, India"
            },
            business_name: {
                type: "string",
                example: "Skyraan Technologies"
            },
            business_type: {
                type: "string",
                example: "Software"
            },
            enquiry: {
                type: "string",
                example: "I would like to promote my business through your application."
            },
            is_logged_user: {
                type: "integer",
                enum: [0, 1],
                example: 1,
                description: "0 = guest/general user, 1 = logged-in user"
            }
        }
    },

    EnquiryResponse: {
        type: "object",
        properties: {
            success: {
                type: "boolean",
                example: true
            },
            message: {
                type: "string",
                example: "Enquiry submitted successfully"
            },
            data: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        example: 1
                    },
                    name: {
                        type: "string",
                        example: "Naveen"
                    },
                    phone: {
                        type: "string",
                        nullable: true,
                        example: "9876543210"
                    },
                    email: {
                        type: "string",
                        example: "youremail@gmail.com"
                    },
                    location: {
                        type: "string",
                        example: "Coimbatore, Tamil Nadu, India"
                    },
                    business_name: {
                        type: "string",
                        example: "Skyraan Technologies"
                    },
                    business_type: {
                        type: "string",
                        example: "Software"
                    },
                    enquiry: {
                        type: "string",
                        nullable: true,
                        example: "I would like to promote my business through your application."
                    },
                    is_logged_user: {
                        type: "integer",
                        enum: [0, 1],
                        example: 1,
                        description: "0 = guest/general user, 1 = logged-in user"
                    },
                    status: {
                        type: "string",
                        enum: [
                            "pending",
                            "contacted",
                            "accept-closed",
                            "decline-closed"
                        ],
                        example: "pending"
                    },
                    created_at: {
                        type: "string",
                        format: "date-time",
                        example: "2026-09-22T13:30:00.000Z"
                    },
                }
            }
        }
    }
};

export default enquirySchema;