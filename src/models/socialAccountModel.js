import pool from "../configs/database/db.js";

export const findSocialAccount = async ({
    provider,
    providerUserId
}) => {
    const [rows] = await pool.execute(
        `SELECT
            id,
            user_id,
            provider,
            provider_user_id,
            created_at,
            updated_at
        FROM user_social_accounts
        WHERE provider = ?
        AND provider_user_id = ?
        LIMIT 1`,
        [
            provider,
            providerUserId
        ]
    );

    return rows[0] || null;
};

export const createSocialAccount = async ({
    userId,
    provider,
    providerUserId
}) => {
    const [result] = await pool.execute(
        `INSERT INTO user_social_accounts
        (
            user_id,
            provider,
            provider_user_id
        )
        VALUES (?, ?, ?)`,
        [
            userId,
            provider,
            providerUserId
        ]
    );

    return result.insertId;
};

export const deleteSocialAccountsByUserId = async (userId) => {
    await pool.execute(
        `DELETE FROM user_social_accounts
        WHERE user_id = ?`,
        [userId]
    );
};