import { loginAdmin } from "../services/adminAuthService.js";
import { adminLoginSchema } from "../validators/adminAuthValidator.js";

export const loginAdminController = async (req, res) => {
    try {
        const { error, value } = adminLoginSchema.validate(req.body, {
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

        const admin = await loginAdmin(
            value.email,
            value.password
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful",
            data: admin
        });

    } catch (error) {
        console.error("ADMIN LOGIN ERROR:", error);

        if (error.statusCode) {
            return res.status(error.statusCode).json({
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