
import pool from "../configs/database/db.js";
import jwt from "jsonwebtoken";

export const middleware = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;

        if (!authorization) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required."
            });
        }

        const [scheme, token] = authorization.split(" ");

        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format."
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET
        );

        if (decoded.type !== "access") {
            return res.status(401).json({
                success: false,
                message: "Invalid access token."
            });
        }

        // Check whether the user exists and is eligible to access.
        const [rows] = await pool.execute(
            `SELECT id, permanently_deleted, is_account_deleted
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [decoded.sub]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User account not found."
            });
        }

        const user = rows[0];

        if (Number(user.permanently_deleted) === 1) {
            return res.status(403).json({
                success: false,
                message: "Your account has been permanently deleted."
            });
        }

        if (Number(user.is_account_deleted) === 1) {
            return res.status(403).json({
                success: false,
                message: "Your account is pending deletion. Please reactivate your account."
            });
        }

        // Update latest user activity.
        await pool.execute(
            `UPDATE users
             SET last_activity_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND permanently_deleted = 0`,
            [user.id]
        );

        req.user = {
            id: user.id
        };

        next();

    } catch (error) {
        console.error("Authentication middleware error:", error);

        if (error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError") {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired access token."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Authentication failed."
        });
    }
};
