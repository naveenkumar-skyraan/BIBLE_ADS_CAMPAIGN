import pool from "../configs/database/db.js";

export const findAccountByUserId = async (userId) => {
    const [rows] = await pool.execute(
        `SELECT
            id,
            user_id,
            device_id,
            device_token,
            device_type,
            is_logged_in,
            created_at,
            updated_at
        FROM accounts
        WHERE user_id = ?
        LIMIT 1`,
        [userId]
    );

    return rows[0] || null;
};

export const createAccount = async ({
    userId,
    deviceId,
    deviceToken,
    deviceType
}) => {
    const [result] = await pool.execute(
        `INSERT INTO accounts
        (
            user_id,
            device_id,
            device_token,
            device_type,
            is_logged_in
        )
        VALUES (?, ?, ?, ?, 1)`,
        [
            userId,
            deviceId,
            deviceToken,
            deviceType
        ]
    );

    return result.insertId;
};

export const updateAccount = async ({
    userId,
    deviceId,
    deviceToken,
    deviceType
}) => {
    await pool.execute(
        `UPDATE accounts
        SET
            device_id = ?,
            device_token = ?,
            device_type = ?,
            is_logged_in = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
        [
            deviceId,
            deviceToken,
            deviceType,
            userId
        ]
    );
};

export const logoutAccount = async (userId) => {
    await pool.execute(
        `UPDATE accounts
        SET
            is_logged_in = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
        [userId]
    );
};