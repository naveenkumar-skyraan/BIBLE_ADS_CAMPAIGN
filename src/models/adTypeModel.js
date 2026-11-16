import db from "../configs/database/db.js";

export const createAdType = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO ad_types
      (
        name,
        code,
        description,
        preview_image_url,
        preview_description,
        sort_order,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.code,
      data.description ?? null,
      data.preview_image_url ?? null,
      data.preview_description ?? null,
      data.sort_order,
      data.is_active,
    ],
  );

  return result.insertId;
};

export const getAllAdTypes = async ({ includeInactive = true } = {}) => {
  const sql = `
    SELECT
      id,
      name,
      code,
      description,
      preview_image_url,
      preview_description,
      sort_order,
      is_active
    FROM ad_types
    ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY sort_order, id
  `;

  const [types] = await db.execute(sql);

  if (!types.length) return [];

  const [subtypes] = await db.execute(
    `SELECT
      s.id,
      s.ad_type_id,
      s.name,
      s.code,
      s.description,
      s.preview_image_url,
      s.preview_description,
      s.sort_order,
      s.is_active
   FROM ad_subtypes s
   INNER JOIN ad_types t
     ON t.id = s.ad_type_id
   ${includeInactive ? "" : "WHERE s.is_active = 1 AND t.is_active = 1"}
   ORDER BY s.sort_order, s.id`,
  );

  const subtypeMap = new Map();

  for (const subtype of subtypes) {
    if (!subtypeMap.has(subtype.ad_type_id)) {
      subtypeMap.set(subtype.ad_type_id, []);
    }

    subtypeMap.get(subtype.ad_type_id).push(subtype);
  }

  return types.map((type) => ({
    ...type,
    sub_types: subtypeMap.get(type.id) ?? [],
  }));
};

export const getAdTypeById = async (id) => {
  const [rows] = await db.execute(
    `SELECT
        id,
        name,
        code,
        description,
        preview_image_url,
        preview_description,
        sort_order,
        is_active
     FROM ad_types
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  if (!rows.length) return null;

  const type = rows[0];

  const [subtypes] = await db.execute(
    `SELECT
        id,
        ad_type_id,
        name,
        code,
        description,
        preview_image_url,
        preview_description,
        sort_order,
        is_active
     FROM ad_subtypes
     WHERE ad_type_id = ?
     ORDER BY sort_order, id`,
    [id],
  );

  return {
    ...type,
    sub_types: subtypes,
  };
};

export const updateAdType = async (id, data) => {
  const [result] = await db.execute(
    `UPDATE ad_types
     SET
       name = ?,
       code = ?,
       description = ?,
       preview_image_url = ?,
       preview_description = ?,
       sort_order = ?,
       is_active = ?
     WHERE id = ?`,
    [
      data.name,
      data.code,
      data.description ?? null,
      data.preview_image_url ?? null,
      data.preview_description ?? null,
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
