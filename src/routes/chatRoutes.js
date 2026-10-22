import express from "express";
import chatController from "../controllers/chatController.js";
// import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chat Support
 *   description: User chat support APIs
 */

/**
 * @swagger
 * /api/chat/status:
 *   get:
 *     summary: Check admin online status
 *     tags: [Chat Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin online status retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// router.use(middleware);

router.get("/status", chatController.getStatus);

/**
 * @swagger
 * /api/chat/conversations:
 *   post:
 *     summary: Start a new support conversation
 *     tags: [Chat Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Conversation created with welcome message
 *       401:
 *         description: Unauthorized
 */
router.post("/conversations", chatController.startConversation);

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: Get the current user's conversations
 *     tags: [Chat Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/conversations", chatController.getConversations);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages for a conversation
 *     tags: [Chat Support]
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
  chatController.getMessages,
);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/messages:
 *   post:
 *     summary: Send a message to support
 *     tags: [Chat Support]
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
 *                 example: I need help with my ad campaign.
 *     responses:
 *       201:
 *         description: Message submitted successfully
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
  chatController.sendMessage,
);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/end:
 *   post:
 *     summary: End the current user's support conversation
 *     description: Verifies conversation ownership and closes the conversation. The user can no longer send messages to a closed conversation.
 *     tags: [Chat Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the conversation to close
 *     responses:
 *       200:
 *         description: Conversation closed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Conversation closed successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversationId:
 *                       type: integer
 *                       example: 12
 *                     status:
 *                       type: string
 *                       example: closed
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *       404:
 *         description: Conversation not found or does not belong to the logged-in user
 */
router.post(
  "/conversations/:conversationId/end",
  chatController.endConversation,
);

export default router;
