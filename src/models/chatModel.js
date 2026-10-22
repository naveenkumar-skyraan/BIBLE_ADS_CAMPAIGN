import pool from "../configs/database/db.js";

const chatModel = {
  async createConversation(userId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [conversationResult] = await connection.execute(
        `INSERT INTO chat_conversations (user_id)
         VALUES (?)`,
        [userId],
      );

      const conversationId = conversationResult.insertId;

      await connection.execute(
        `INSERT INTO chat_messages
         (conversation_id, sender_type, sender_id, message)
         VALUES (?, 'system', NULL, ?)`,
        [
          conversationId,
          "Hi! Welcome to Bible Ads Campaign Support. How can we help you today?",
        ],
      );

      await connection.commit();

      return conversationId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getLatestConversation(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, status, created_at, updated_at,
              resolved_at, closed_at
       FROM chat_conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [userId],
    );

    return rows[0] || null;
  },

  async findConversationById(conversationId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, status, created_at, updated_at,
              resolved_at, closed_at
       FROM chat_conversations
       WHERE id = ?
       LIMIT 1`,
      [conversationId],
    );

    return rows[0] || null;
  },

  async findConversation(conversationId, userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, status, created_at, updated_at,
              resolved_at, closed_at
       FROM chat_conversations
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [conversationId, userId],
    );

    return rows[0] || null;
  },

  async createMessage(conversationId, senderType, senderId, message) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO chat_messages
         (conversation_id, sender_type, sender_id, message)
         VALUES (?, ?, ?, ?)`,
        [conversationId, senderType, senderId, message],
      );

      await connection.execute(
        `UPDATE chat_conversations
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [conversationId],
      );

      await connection.commit();

      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getMessages(conversationId) {
    const [rows] = await pool.execute(
      `SELECT id, conversation_id, sender_type, sender_id,
              message, created_at
       FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY id ASC`,
      [conversationId],
    );

    return rows;
  },

  async updateConversationStatus(conversationId, status) {
    await pool.execute(
      `UPDATE chat_conversations
       SET status = ?,
           resolved_at = CASE
             WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP
             WHEN ? = 'in_progress' THEN NULL
             ELSE resolved_at
           END,
           closed_at = CASE
             WHEN ? = 'closed' THEN CURRENT_TIMESTAMP
             WHEN ? = 'in_progress' THEN NULL
             ELSE closed_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        status,
        status,
        status,
        status,
        status,
        conversationId,
      ],
    );
  },

  async getUserConversations(userId) {
    const [rows] = await pool.execute(
      `SELECT c.id, c.status, c.created_at, c.updated_at,
              c.resolved_at, c.closed_at,
              (
                SELECT m.message
                FROM chat_messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message
       FROM chat_conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId],
    );

    return rows;
  },

  async hasMessage(conversationId, senderType, message) {
    const [rows] = await pool.execute(
      `SELECT id
       FROM chat_messages
       WHERE conversation_id = ?
         AND sender_type = ?
         AND message = ?
       LIMIT 1`,
      [conversationId, senderType, message],
    );

    return rows.length > 0;
  },
};

export default chatModel;