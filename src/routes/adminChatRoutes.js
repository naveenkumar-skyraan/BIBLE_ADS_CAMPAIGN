import express from "express";
import adminChatController from "../controllers/adminChatController.js";
import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Chat Support
 *   description: Admin APIs for managing chat support conversations
 */

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /api/admin/chat/conversations:
 *   get:
 *     summary: Get all support conversations
 *     tags: [Admin Chat Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get("/conversations", adminChatController.getAllConversations);

/**
 * @swagger
 * /api/admin/chat/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get conversation details and messages
 *     tags: [Admin Chat Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation and messages retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get(
  "/conversations/:conversationId/messages",
  adminChatController.getConversationMessages,
);

/**
 * @swagger
 * /api/admin/chat/conversations/{conversationId}/messages:
 *   post:
 *     summary: Reply to a support conversation
 *     tags: [Admin Chat Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 5000
 *                 example: We have received your issue and are checking it.
 *     responses:
 *       201:
 *         description: Reply sent successfully
 *       400:
 *         description: Invalid message
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *       409:
 *         description: Conversation is resolved or closed
 */
router.post(
  "/conversations/:conversationId/messages",
  adminChatController.sendReply,
);

/**
 * @swagger
 * /api/admin/chat/conversations/{conversationId}/status:
 *   patch:
 *     summary: Update conversation status
 *     tags: [Admin Chat Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *                 example: resolved
 *     responses:
 *       200:
 *         description: Conversation status updated successfully
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.patch(
  "/conversations/:conversationId/status",
  adminChatController.updateStatus,
);

export default router;
