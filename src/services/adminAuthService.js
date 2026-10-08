import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
    getAdminByEmail
} from "../models/adminAuthModel.js";

export const loginAdmin = async (email, password) => {
    const admin = await getAdminByEmail(email);

    if (!admin) {
        const error = new Error("Invalid email or password.");
        error.statusCode = 401;
        throw error;
    }

    if (admin.is_active !== 1) {
        const error = new Error("Admin account is inactive.");
        error.statusCode = 403;
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        admin.password_hash
    );

    if (!isPasswordValid) {
        const error = new Error("Invalid email or password.");
        error.statusCode = 401;
        throw error;
    }

    const accessToken = jwt.sign(
        {
            sub: String(admin.id),
            type: "access",
            role: "admin"
        },
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn:
                process.env.JWT_ACCESS_EXPIRES_IN
        }
    );

    return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        accessToken
    };
};