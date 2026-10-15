import db from "../configs/database/db.js";

export const createIssueType = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO issue_types (name, display_order, is_active, is_deleted)
     VALUES (?, ?, ?, 0)`,
    [data.name, data.display_order ?? 0, data.is_active ?? 1],
  );

  return result.insertId;
};

export const getAllIssueTypes = async () => {
  const [rows] = await db.execute(
    `SELECT id, name, display_order, is_active, created_at, updated_at
     FROM issue_types
     WHERE is_deleted = 0
     ORDER BY display_order, id`,
  );

  return rows;
};

export const getIssueTypeById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, name, display_order, is_active, created_at, updated_at
     FROM issue_types
     WHERE id = ? AND is_deleted = 0
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
};

export const updateIssueType = async (id, data) => {
  const [result] = await db.execute(
    `UPDATE issue_types
     SET name = ?, display_order = ?, is_active = ?
     WHERE id = ? AND is_deleted = 0`,
    [data.name, data.display_order, data.is_active, id],
  );

  return result.affectedRows;
};

export const updateIssueTypeStatus = async (id, isActive) => {
  const [result] = await db.execute(
    `UPDATE issue_types
     SET is_active = ?
     WHERE id = ? AND is_deleted = 0`,
    [isActive, id],
  );

  return result.affectedRows;
};

export const deleteIssueType = async (id) => {
  const [result] = await db.execute(
    `UPDATE issue_types
     SET is_deleted = 1, is_active = 0
     WHERE id = ? AND is_deleted = 0`,
    [id],
  );

  return result.affectedRows;
};

export const getAllReportedIssues = async (filters = {}) => {
  let sql = `
    SELECT
      r.id,
      r.user_id,
      r.issue_type_id,
      t.name AS issue_type,
      r.description,
      r.screenshot_path,
      r.status,
      r.created_at,
      r.updated_at
    FROM reported_issues r
    INNER JOIN issue_types t ON t.id = r.issue_type_id
    WHERE r.is_deleted = 0
  `;

  const params = [];

  if (filters.status !== undefined) {
    sql += " AND r.status = ?";
    params.push(filters.status);
  }

  if (filters.issue_type_id !== undefined) {
    sql += " AND r.issue_type_id = ?";
    params.push(filters.issue_type_id);
  }

  sql += " ORDER BY r.created_at DESC, r.id DESC";

  const [rows] = await db.execute(sql, params);
  return rows;
};

export const getReportedIssueById = async (id) => {
  const [rows] = await db.execute(
    `SELECT
       r.id,
       r.user_id,
       r.issue_type_id,
       t.name AS issue_type,
       r.description,
       r.screenshot_path,
       r.status,
       r.created_at,
       r.updated_at
     FROM reported_issues r
     INNER JOIN issue_types t ON t.id = r.issue_type_id
     WHERE r.id = ? AND r.is_deleted = 0
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
};

export const updateReportedIssueStatus = async (id, status) => {
  const [result] = await db.execute(
    `UPDATE reported_issues
     SET status = ?
     WHERE id = ? AND is_deleted = 0`,
    [status, id],
  );

  return result.affectedRows;
};

export const deleteReportedIssue = async (id) => {
  const [result] = await db.execute(
    `UPDATE reported_issues
     SET is_deleted = 1
     WHERE id = ? AND is_deleted = 0`,
    [id],
  );

  return result.affectedRows;
};
