import jwt from "jsonwebtoken";

export const adminAuthMiddleware = (req, res, next) => {
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

        if (
            decoded.type !== "access" ||
            decoded.role !== "admin" ||
            !decoded.sub
        ) {
            return res.status(403).json({
                success: false,
                message: "Admin access is required."
            });
        }

        req.admin = {
            id: decoded.sub,
            role: decoded.role
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired admin access token."
        });
    }
};