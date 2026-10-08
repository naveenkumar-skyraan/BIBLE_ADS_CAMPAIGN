import {
    socialLogin
} from "../services/socialAuthService.js";

export const socialLoginController = async (req, res) => {
    try {
        const {
            provider,
            providerUserId,
            name,
            deviceId,
            deviceToken,
            deviceType
        } = req.body;

        const result = await socialLogin({
            provider,
            providerUserId,
            name,
            deviceId,
            deviceToken,
            deviceType
        });

        return res.status(200).json({
            success: true,
            message: "Social login successful.",
            data: result
        });
    } catch (error) {
        console.error(
            "SOCIAL LOGIN ERROR:",
            error
        );

        if (error.code === "USER_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "ACCOUNT_DELETION_PENDING") {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "INVALID_REFRESH_TOKEN") {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Social login failed."
        });
    }
};