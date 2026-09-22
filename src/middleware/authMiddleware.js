
import jwt from "jsonwebtoken";

export const middleware = (req, res, next) => {
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

        req.user = {
            id: decoded.sub
        };

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token."
        });
    }
};