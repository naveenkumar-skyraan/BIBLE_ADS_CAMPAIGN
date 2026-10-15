import db from "../configs/database/db.js";

export const createFaqCategory = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO faq_categories
         (name, display_order, is_active)
         VALUES (?, ?, ?)`,
    [data.name, data.display_order ?? 0, data.is_active ?? 1],
  );

  return result.insertId;
};

export const getAllFaqCategories = async () => {
  const [rows] = await db.execute(
    `SELECT
             c.*,
             (
                 SELECT COUNT(*)
                 FROM faq_questions q
                 WHERE q.category_id = c.id
                   AND q.is_deleted = 0
                   AND q.is_published = 1
             ) AS question_count
         FROM faq_categories c
         WHERE c.is_deleted = 0
         ORDER BY c.display_order, c.id`,
  );

  return rows;
};

export const getFaqCategoryById = async (id) => {
  const [rows] = await db.execute(
    `SELECT *
         FROM faq_categories
         WHERE id = ?
           AND is_deleted = 0
         LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
};

export const updateFaqCategory = async (id, data) => {
  const [result] = await db.execute(
    `UPDATE faq_categories
         SET name = ?,
             display_order = ?,
             is_active = ?
         WHERE id = ?
           AND is_deleted = 0`,
    [data.name, data.display_order ?? 0, data.is_active ?? 1, id],
  );

  return result.affectedRows;
};

export const updateFaqCategoryStatus = async (id, isActive) => {
  const [result] = await db.execute(
    `UPDATE faq_categories
         SET is_active = ?
         WHERE id = ?
           AND is_deleted = 0`,
    [isActive, id],
  );

  return result.affectedRows;
};

export const deleteFaqCategory = async (id) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [categoryResult] = await connection.execute(
      `UPDATE faq_categories
             SET is_deleted = 1
             WHERE id = ?
               AND is_deleted = 0`,
      [id],
    );

    if (categoryResult.affectedRows) {
      await connection.execute(
        `UPDATE faq_questions
                 SET is_deleted = 1
                 WHERE category_id = ?
                   AND is_deleted = 0`,
        [id],
      );

      await connection.execute(
        `UPDATE faq_answers a
                 INNER JOIN faq_questions q
                     ON q.id = a.question_id
                 SET a.is_deleted = 1
                 WHERE q.category_id = ?
                   AND a.is_deleted = 0`,
        [id],
      );
    }

    await connection.commit();
    return categoryResult.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const createFaqQuestion = async (data) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [categories] = await connection.execute(
      `SELECT id
             FROM faq_categories
             WHERE id = ?
               AND is_deleted = 0
             LIMIT 1`,
      [data.category_id],
    );

    if (!categories.length) {
      throw new Error("FAQ category not found");
    }

    const [questionResult] = await connection.execute(
      `INSERT INTO faq_questions
             (category_id, question, display_order, is_published)
             VALUES (?, ?, ?, ?)`,
      [
        data.category_id,
        data.question,
        data.display_order ?? 0,
        data.is_published ?? 1,
      ],
    );

    await connection.execute(
      `INSERT INTO faq_answers
             (question_id, answer_content)
             VALUES (?, ?)`,
      [questionResult.insertId, data.answer_content],
    );

    await connection.commit();
    return questionResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getAllFaqQuestions = async ({ categoryId = null } = {}) => {
  const conditions = ["q.is_deleted = 0", "c.is_deleted = 0"];

  const params = [];

  if (categoryId !== null && categoryId !== undefined) {
    conditions.push("q.category_id = ?");
    params.push(categoryId);
  }

  const [rows] = await db.execute(
    `SELECT
             q.*,
             c.name AS category_name,
             a.answer_content
         FROM faq_questions q
         INNER JOIN faq_categories c
             ON c.id = q.category_id
         LEFT JOIN faq_answers a
             ON a.question_id = q.id
            AND a.is_deleted = 0
         WHERE ${conditions.join(" AND ")}
         ORDER BY c.display_order, q.display_order, q.id`,
    params,
  );

  return rows;
};

export const getFaqQuestionById = async (id) => {
  const [rows] = await db.execute(
    `SELECT
             q.*,
             c.name AS category_name,
             a.id AS answer_id,
             a.answer_content
         FROM faq_questions q
         INNER JOIN faq_categories c
             ON c.id = q.category_id
            AND c.is_deleted = 0
         LEFT JOIN faq_answers a
             ON a.question_id = q.id
            AND a.is_deleted = 0
         WHERE q.id = ?
           AND q.is_deleted = 0
         LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
};

export const updateFaqQuestion = async (id, data) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [questions] = await connection.execute(
      `SELECT id
             FROM faq_questions
             WHERE id = ?
               AND is_deleted = 0
             LIMIT 1
             FOR UPDATE`,
      [id],
    );

    if (!questions.length) {
      await connection.rollback();
      return 0;
    }

    const [categories] = await connection.execute(
      `SELECT id
             FROM faq_categories
             WHERE id = ?
               AND is_deleted = 0
             LIMIT 1`,
      [data.category_id],
    );

    if (!categories.length) {
      throw new Error("FAQ category not found");
    }

    await connection.execute(
      `UPDATE faq_questions
             SET category_id = ?,
                 question = ?,
                 display_order = ?,
                 is_published = ?
             WHERE id = ?
               AND is_deleted = 0`,
      [
        data.category_id,
        data.question,
        data.display_order ?? 0,
        data.is_published ?? 1,
        id,
      ],
    );

    const [answers] = await connection.execute(
      `SELECT id
             FROM faq_answers
             WHERE question_id = ?
               AND is_deleted = 0
             LIMIT 1`,
      [id],
    );

    if (answers.length) {
      await connection.execute(
        `UPDATE faq_answers
                 SET answer_content = ?
                 WHERE question_id = ?
                   AND is_deleted = 0`,
        [data.answer_content, id],
      );
    } else {
      await connection.execute(
        `INSERT INTO faq_answers
                 (question_id, answer_content, is_deleted)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE
                     answer_content = VALUES(answer_content),
                     is_deleted = 0`,
        [id, data.answer_content],
      );
    }

    await connection.commit();
    return 1;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateFaqQuestionStatus = async (id, isPublished) => {
  const [result] = await db.execute(
    `UPDATE faq_questions q
         INNER JOIN faq_categories c
             ON c.id = q.category_id
         SET q.is_published = ?
         WHERE q.id = ?
           AND q.is_deleted = 0
           AND c.is_deleted = 0`,
    [isPublished, id],
  );

  return result.affectedRows;
};

export const deleteFaqQuestion = async (id) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [questionResult] = await connection.execute(
      `UPDATE faq_questions
             SET is_deleted = 1
             WHERE id = ?
               AND is_deleted = 0`,
      [id],
    );

    if (questionResult.affectedRows) {
      await connection.execute(
        `UPDATE faq_answers
                 SET is_deleted = 1
                 WHERE question_id = ?
                   AND is_deleted = 0`,
        [id],
      );
    }

    await connection.commit();
    return questionResult.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
