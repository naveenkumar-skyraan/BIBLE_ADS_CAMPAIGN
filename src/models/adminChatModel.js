import pool from "../configs/database/db.js";

const adminChatModel = {
    async getAllConversations() {
        const [rows] = await pool.execute(
            `SELECT
                c.id,
                c.user_id,
                c.status,
                c.created_at,
                c.updated_at,
                c.resolved_at,
                c.closed_at,
                (
                    SELECT m.message
                    FROM chat_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT m.sender_type
                    FROM chat_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_sender_type
             FROM chat_conversations c
             ORDER BY c.updated_at DESC`
        );

        return rows;
    },

    async findConversation(conversationId) {
        const [rows] = await pool.execute(
            `SELECT
                id,
                user_id,
                status,
                created_at,
                updated_at,
                resolved_at,
                closed_at
             FROM chat_conversations
             WHERE id = ?
             LIMIT 1`,
            [conversationId]
        );

        return rows[0] || null;
    },

    async getMessages(conversationId) {
        const [rows] = await pool.execute(
            `SELECT
                id,
                conversation_id,
                sender_type,
                sender_id,
                message,
                created_at
             FROM chat_messages
             WHERE conversation_id = ?
             ORDER BY id ASC`,
            [conversationId]
        );

        return rows;
    },

    async createMessage(conversationId, adminId, message) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO chat_messages
                    (conversation_id, sender_type, sender_id, message)
                 VALUES (?, 'admin', ?, ?)`,
                [conversationId, adminId, message]
            );

            await connection.execute(
                `UPDATE chat_conversations
                 SET updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [conversationId]
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

    async updateConversationStatus(conversationId, status) {
        await pool.execute(
            `UPDATE chat_conversations
             SET status = ?,
                 resolved_at = CASE
                     WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP
                     WHEN ? IN ('open', 'in_progress') THEN NULL
                     ELSE resolved_at
                 END,
                 closed_at = CASE
                     WHEN ? = 'closed' THEN CURRENT_TIMESTAMP
                     WHEN ? IN ('open', 'in_progress') THEN NULL
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
                conversationId
            ]
        );
    }
};

export default adminChatModel;