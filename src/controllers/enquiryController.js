import { submitEnquiry } from "../services/enquiryService.js";
import { createEnquirySchema } from "../validators/enquiryValidator.js";

export const createEnquiryController = async (req, res) => {
    try {
        const { error, value } = createEnquirySchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = {};

            error.details.forEach((detail) => {
                const field = detail.path[0];

                if (!errors[field]) {
                    errors[field] = detail.message;
                }
            });

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors
            });
        }

        const enquiry = await submitEnquiry(value);

        return res.status(201).json({
            success: true,
            message: "Enquiry submitted successfully",
            data: enquiry
        });

    } catch (error) {
        console.error("CREATE ENQUIRY ERROR:", error);

        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};