
import db from "../configs/database/db.js";

export const getActiveIssueTypes = async () => {
  const [rows] = await db.execute(
    `SELECT id, name, display_order
     FROM issue_types
     WHERE is_active = 1 AND is_deleted = 0
     ORDER BY display_order, id`
  );

  return rows;
};

export const getActiveIssueTypeById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id
     FROM issue_types
     WHERE id = ? AND is_active = 1 AND is_deleted = 0
     LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
};

export const createReportedIssue = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO reported_issues
      (user_id, issue_type_id, description, screenshot_path, status, is_deleted)
     VALUES (?, ?, ?, ?, 1, 0)`,
    [
      data.user_id,
      data.issue_type_id,
      data.description,
      data.screenshot_path
    ]
  );

  return result.insertId;
};
