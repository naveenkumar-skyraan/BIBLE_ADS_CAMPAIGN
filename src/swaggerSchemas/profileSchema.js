
export const profileSchema = {
    UpdateProfileRequest: {
        type: "object",
        required: ["name", "phone"],
        properties: {
            name: {
                type: "string",
                minLength: 2,
                maxLength: 100,
                example: "Naveen Kumar"
            },
            phone: {
                type: "string",
                pattern: "^[0-9]{10}$",
                example: "9876543210"
            },
            email: {
                type: "string",
                format: "email",
                maxLength: 255,
                nullable: true,
                example: "yourmail@gmail.com"
            }
        }
    },

    ProfileResponse: {
        type: "object",
        properties: {
            id: {
                type: "integer",
                example: 1
            },
            name: {
                type: "string",
                example: "Naveen Kumar"
            },
            phone: {
                type: "string",
                example: "9876543210"
            },
            email: {
                type: "string",
                nullable: true,
                example: "yourmail@gmail.com"
            },
            created_at: {
                type: "string",
                format: "date-time"
            },
            updated_at: {
                type: "string",
                format: "date-time"
            }
        }
    }
};

export default profileSchema;
