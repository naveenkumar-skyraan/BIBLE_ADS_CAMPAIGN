import pool from "../configs/database/db.js";

const businessDetailModel = {
  async create(connection, data) {
    const [result] = await connection.execute(
      `INSERT INTO business_details (
                user_id,
                name,
                business_name,
                email,
                country_code,
                admin_area_1,
                admin_area_2,
                city,
                area,
                postal_code,
                tax_id,
                tax_id_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.name,
        data.business_name,
        data.email || null,
        data.country_code,
        data.admin_area_1 || null,
        data.admin_area_2 || null,
        data.city || null,
        data.area || null,
        data.postal_code || null,
        data.tax_id || null,
        data.tax_id_type || null,
      ],
    );

    return result.insertId;
  },

  async findById(id, userId, connection = pool) {
    const [rows] = await connection.execute(
      `SELECT *
         FROM business_details
         WHERE id = ?
           AND user_id = ?
           AND is_deleted = 0
         LIMIT 1`,
      [id, userId],
    );

    return rows[0] || null;
  },

  async findByUserId(userId, connection = pool) {
    const [rows] = await connection.execute(
      `SELECT *
         FROM business_details
         WHERE user_id = ?
           AND is_deleted = 0
         ORDER BY is_selected DESC, created_at DESC`,
      [userId],
    );

    return rows;
  },

  async update(connection, id, userId, data) {
    const allowedFields = [
      "name",
      "business_name",
      "email",
      "country_code",
      "admin_area_1",
      "admin_area_2",
      "city",
      "area",
      "postal_code",
      "tax_id",
      "tax_id_type",
    ];

    const fields = allowedFields.filter((field) => Object.hasOwn(data, field));

    if (fields.length === 0) {
      return false;
    }

    const values = fields.map((field) => {
      if (data[field] === "") return null;
      return data[field] ?? null;
    });

    const assignments = fields.map((field) => `${field} = ?`).join(", ");

    const [result] = await connection.execute(
      `UPDATE business_details
             SET ${assignments}, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    );

    return result.affectedRows > 0;
  },

  async select(connection, id, userId) {
    await connection.execute(
      `UPDATE business_details
             SET is_selected = 0
             WHERE user_id = ?`,
      [userId],
    );

    const [result] = await connection.execute(
      `UPDATE business_details
             SET is_selected = 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
      [id, userId],
    );

    return result.affectedRows > 0;
  },

  async getDependencies(connection, id, userId) {
    const [ads] = await connection.execute(
      `SELECT COUNT(*) AS total
             FROM ads
             WHERE business_id = ? AND user_id = ?`,
      [id, userId],
    );

    const [funds] = await connection.execute(
      `SELECT COUNT(*) AS total
             FROM ad_fund_allocations
             WHERE business_id = ? AND user_id = ?`,
      [id, userId],
    );

    return {
      ads: Number(ads[0].total),
      funds: Number(funds[0].total),
    };
  },

  async delete(connection, id, userId) {
    const [result] = await connection.execute(
      `UPDATE business_details
         SET is_deleted = 1,
             is_selected = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND user_id = ?
           AND is_deleted = 0`,
      [id, userId],
    );

    return result.affectedRows > 0;
  },
};

export default businessDetailModel;
