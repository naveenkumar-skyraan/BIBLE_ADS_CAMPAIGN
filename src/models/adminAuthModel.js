
import pool from "../configs/database/db.js";

export const getAdminByEmail = async (email) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            name,
            email,
            password_hash,
            is_active,
            created_at,
            updated_at
        FROM admins
        WHERE email = ?
        LIMIT 1
        `,
        [email]
    );

    return rows[0] || null;
};