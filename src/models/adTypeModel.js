import db from "../configs/database/db.js";

export const createAdType = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO ad_types
         (
             name,
             code,
             description,
             preview_image_url,
             sort_order,
             is_active
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.code,
      data.description ?? null,
      data.preview_image_url ?? null,
      data.sort_order,
      data.is_active,
    ],
  );

  return result.insertId;
};

export const getAllAdTypes = async ({ includeInactive = true } = {}) => {
  const sql = includeInactive
    ? `SELECT id, 
    name, 
    code, 
    description, 
    preview_image_url, 
    sort_order, 
    is_active FROM ad_types ORDER BY sort_order, id`
    : `SELECT id, 
    name, 
    code, 
    description, 
    preview_image_url, 
    sort_order, 
    is_active FROM ad_types
           WHERE is_active = 1
           ORDER BY sort_order, id`;

  const [rows] = await db.execute(sql);
  return rows;
};

export const getAdTypeById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id,
        name,
        code,
        description,
        preview_image_url,
        sort_order,
        is_active FROM ad_types WHERE id = ? LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
};

export const updateAdType = async (id, data) => {
  const [result] = await db.execute(
    `UPDATE ad_types
         SET name = ?,
             code = ?,
             description = ?,
             preview_image_url = ?,
             sort_order = ?,
             is_active = ?
         WHERE id = ?`,
    [
      data.name,
      data.code,
      data.description ?? null,
      data.preview_image_url ?? null,
      data.sort_order,
      data.is_active,
      id,
    ],
  );

  return result.affectedRows;
};

export const updateAdTypeStatus = async (id, isActive) => {
  const [result] = await db.execute(
    `UPDATE ad_types
         SET is_active = ?
         WHERE id = ?`,
    [isActive, id],
  );

  return result.affectedRows;
};
