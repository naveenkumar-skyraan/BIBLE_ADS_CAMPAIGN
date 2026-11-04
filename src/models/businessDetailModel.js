import pool from "../configs/database/db.js";

const buildAdminBusinessConditions = ({
  search = "",
  verification_status = null,
} = {}) => {
  const conditions = ["bd.is_deleted = 0"];
  const values = [];

  const searchTerm = String(search || "").trim();

  if (searchTerm) {
    conditions.push(`(
      bd.name LIKE ?
      OR bd.business_name LIKE ?
      OR bd.email LIKE ?
      OR u.name LIKE ?
      OR u.email LIKE ?
      OR u.phone LIKE ?
    )`);

    const keyword = `%${searchTerm}%`;
    values.push(keyword, keyword, keyword, keyword, keyword, keyword);
  }

  const statusFilter = String(verification_status || "").trim();

  if (statusFilter) {
    conditions.push("bd.verification_status = ?");
    values.push(statusFilter);
  }

  return {
    whereClause: conditions.join(" AND "),
    values,
  };
};

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
        tax_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async getAdminBusinesses({
    search = "",
    verification_status = null,
    limit = 10,
    offset = 0,
  } = {}) {
    const { whereClause, values } = buildAdminBusinessConditions({
      search,
      verification_status,
    });

    const [businesses] = await pool.execute(
      `SELECT
        bd.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
       FROM business_details bd
       LEFT JOIN users u ON u.id = bd.user_id
       WHERE ${whereClause}
       ORDER BY bd.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), Number(offset)],
    );

    return businesses;
  },

  async getAdminBusinessesCount({
    search = "",
    verification_status = null,
  } = {}) {
    const { whereClause, values } = buildAdminBusinessConditions({
      search,
      verification_status,
    });

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM business_details bd
       LEFT JOIN users u ON u.id = bd.user_id
       WHERE ${whereClause}`,
      values,
    );

    return Number(countRows[0].total);
  },

  async getAdminBusinessById(id) {
    const [rows] = await pool.execute(
      `SELECT
        bd.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
       FROM business_details bd
       LEFT JOIN users u ON u.id = bd.user_id
       WHERE bd.id = ?
         AND bd.is_deleted = 0
       LIMIT 1`,
      [id],
    );

    return rows[0] || null;
  },

  async updateAdminBusinessDetails(connection, id, data) {
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
    ];

    const fields = allowedFields.filter((field) => Object.hasOwn(data, field));

    if (fields.length === 0) {
      return false;
    }

    const values = fields.map((field) =>
      data[field] === "" ? null : (data[field] ?? null),
    );

    const assignments = fields.map((field) => `${field} = ?`).join(", ");

    const [result] = await connection.execute(
      `UPDATE business_details
       SET ${assignments},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND is_deleted = 0
         AND verification_status = 'contacted'`,
      [...values, id],
    );

    return result.affectedRows > 0 || result.changedRows === 0;
  },
};

export const hasBusinessByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id
     FROM business_details
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows.length > 0 ? 1 : 0;
};

export default businessDetailModel;
