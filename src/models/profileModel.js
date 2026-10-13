
import pool from "../configs/database/db.js";

const profileModel = {
    async findProfileById(userId) {
        const [rows] = await pool.execute(
            `SELECT id, name, phone, email, created_at, updated_at
             FROM users
             WHERE id = ?
               AND is_account_deleted = 0
             LIMIT 1`,
            [userId]
        );

        return rows[0] || null;
    },

    async findUserByPhone(phone, excludeUserId) {
        const [rows] = await pool.execute(
            `SELECT id
             FROM users
             WHERE phone = ?
               AND id != ?
             LIMIT 1`,
            [phone, excludeUserId]
        );

        return rows[0] || null;
    },

    async updateProfile(userId, { name, phone, email }) {
        const [result] = await pool.execute(
            `UPDATE users
             SET name = ?,
                 phone = ?,
                 email = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND is_account_deleted = 0`,
            [name, phone, email, userId]
        );

        return result.affectedRows;
    }
};

export default profileModel;
