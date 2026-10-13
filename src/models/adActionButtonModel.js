import db from "../configs/database/db.js";

export const createAdActionButton = async (data) => {
    const [result] = await db.execute(
        `INSERT INTO ad_action_button_types
         (name, code, sort_order, is_active)
         VALUES (?, ?, ?, ?)`,
        [
            data.name,
            data.code,
            data.sort_order,
            data.is_active
        ]
    );

    return result.insertId;
};

export const getAllAdActionButtons = async ({
    includeInactive = true
} = {}) => {
    const sql = includeInactive
        ? `SELECT
               id,
               name,
               code,
               sort_order,
               is_active,
               created_at,
               updated_at
           FROM ad_action_button_types
           ORDER BY sort_order, id`
        : `SELECT
               id,
               name,
               code,
               sort_order,
               is_active,
               created_at,
               updated_at
           FROM ad_action_button_types
           WHERE is_active = 1
           ORDER BY sort_order, id`;

    const [rows] = await db.execute(sql);

    return rows;
};

export const getAdActionButtonById = async (id) => {
    const [rows] = await db.execute(
        `SELECT
             id,
             name,
             code,
             sort_order,
             is_active,
             created_at,
             updated_at
         FROM ad_action_button_types
         WHERE id = ?
         LIMIT 1`,
        [id]
    );

    return rows[0] ?? null;
};

export const updateAdActionButton = async (id, data) => {
    const [result] = await db.execute(
        `UPDATE ad_action_button_types
         SET name = ?,
             code = ?,
             sort_order = ?,
             is_active = ?
         WHERE id = ?`,
        [
            data.name,
            data.code,
            data.sort_order,
            data.is_active,
            id
        ]
    );

    return result.affectedRows;
};

export const updateAdActionButtonStatus = async (id, isActive) => {
    const [result] = await db.execute(
        `UPDATE ad_action_button_types
         SET is_active = ?
         WHERE id = ?`,
        [
            isActive,
            id
        ]
    );

    return result.affectedRows;
};