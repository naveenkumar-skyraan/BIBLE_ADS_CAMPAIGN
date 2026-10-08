import db from "../configs/database/db.js";

export const createAdObjective = async (data) => {
    const [result] = await db.execute(
        `INSERT INTO ad_objectives
         (name, description, sort_order, is_active)
         VALUES (?, ?, ?, ?)`,
        [
            data.name,
            data.description ?? null,
            data.sort_order,
            data.is_active
        ]
    );

    return result.insertId;
};

export const getAllAdObjectives = async ({
    includeInactive = true
} = {}) => {
    const sql = includeInactive
        ? `SELECT * FROM ad_objectives ORDER BY sort_order, id`
        : `SELECT * FROM ad_objectives
           WHERE is_active = 1
           ORDER BY sort_order, id`;

    const [rows] = await db.execute(sql);
    return rows;
};

export const getAdObjectiveById = async (id) => {
    const [rows] = await db.execute(
        `SELECT * FROM ad_objectives WHERE id = ? LIMIT 1`,
        [id]
    );

    return rows[0] ?? null;
};

export const updateAdObjective = async (id, data) => {
    const [result] = await db.execute(
        `UPDATE ad_objectives
         SET name = ?,
             description = ?,
             sort_order = ?,
             is_active = ?
         WHERE id = ?`,
        [
            data.name,
            data.description ?? null,
            data.sort_order,
            data.is_active,
            id
        ]
    );

    return result.affectedRows;
};

export const updateAdObjectiveStatus = async (id, isActive) => {
    const [result] = await db.execute(
        `UPDATE ad_objectives
         SET is_active = ?
         WHERE id = ?`,
        [isActive, id]
    );

    return result.affectedRows;
};