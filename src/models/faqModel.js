import db from "../configs/database/db.js";

export const getFaqCategories = async () => {
  const [rows] = await db.execute(
    `SELECT
             c.id,
             c.name,
             c.display_order,
             COUNT(q.id) AS question_count
         FROM faq_categories c
         LEFT JOIN faq_questions q
             ON q.category_id = c.id
            AND q.is_deleted = 0
            AND q.is_published = 1
         WHERE c.is_active = 1
           AND c.is_deleted = 0
         GROUP BY c.id, c.name, c.display_order
         ORDER BY c.display_order, c.id`,
  );

  return rows;
};

export const getFaqQuestionsByCategory = async (categoryId) => {
  const [rows] = await db.execute(
    `SELECT
             q.id,
             q.category_id,
             q.question,
             q.display_order
         FROM faq_questions q
         INNER JOIN faq_categories c
             ON c.id = q.category_id
         WHERE q.category_id = ?
           AND q.is_deleted = 0
           AND q.is_published = 1
           AND c.is_deleted = 0
           AND c.is_active = 1
         ORDER BY q.display_order, q.id`,
    [categoryId],
  );

  return rows;
};

export const getFaqQuestionById = async (questionId) => {
  const [rows] = await db.execute(
    `SELECT
             q.id,
             q.category_id,
             q.question,
             a.answer_content,
             q.updated_at
         FROM faq_questions q
         INNER JOIN faq_categories c
             ON c.id = q.category_id
         INNER JOIN faq_answers a
             ON a.question_id = q.id
            AND a.is_deleted = 0
         WHERE q.id = ?
           AND q.is_deleted = 0
           AND q.is_published = 1
           AND c.is_deleted = 0
           AND c.is_active = 1
         LIMIT 1`,
    [questionId],
  );

  return rows[0] ?? null;
};
