
import express from "express";

import {
  getWalletController,
  createTopupController,
  verifyTopupController,
  cashfreeWebhookController,
  getTransactionsController,
  getTransactionController
} from "../controllers/walletController.js";

import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet management and transaction history APIs
 */

/**
 * @swagger
 * /api/wallet/webhook:
 *   post:
 *     summary: Cashfree payment webhook
 *     tags: [Wallet]
 *     description: Receives Cashfree payment status updates and updates the wallet accordingly.
 *     parameters:
 *       - in: header
 *         name: x-webhook-signature
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-webhook-timestamp
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload or signature
 *       500:
 *         description: Webhook processing failed
 */
router.post("/webhook", cashfreeWebhookController);

/**
 * @swagger
 * /api/wallet:
 *   post:
 *     summary: Get wallet details
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetWalletResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch wallet
 */
router.post("/", middleware, getWalletController);

/**
 * @swagger
 * /api/wallet/topups:
 *   post:
 *     summary: Create wallet top-up order
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTopupRequest'
 *     responses:
 *       201:
 *         description: Top-up order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateTopupResponse'
 *       400:
 *         description: Invalid amount or request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to create top-up order
 */
router.post("/topups", middleware, createTopupController);

/**
 * @swagger
 * /api/wallet/topups/verify:
 *   post:
 *     summary: Verify wallet top-up payment
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyTopupRequest'
 *     responses:
 *       200:
 *         description: Payment verification completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyTopupResponse'
 *       400:
 *         description: Invalid order ID or payment verification failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Top-up order not found
 *       500:
 *         description: Payment verification error
 */
router.post("/topups/verify", middleware, verifyTopupController);

/**
 * @swagger
 * /api/wallet/transactions:
 *   post:
 *     summary: Get wallet transaction history
 *     tags: [Wallet]
 *     description: Returns paginated wallet transactions with transaction type and date filters. Successful top-ups are retrieved from wallet transactions, while pending and failed top-ups are retrieved from top-up records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GetWalletTransactionsRequest'
 *     responses:
 *       200:
 *         description: Transactions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetWalletTransactionsResponse'
 *       400:
 *         description: Invalid filters or cursor
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch transactions
 */
router.post("/transactions", middleware, getTransactionsController);

/**
 * @swagger
 * /api/wallet/transactions/details:
 *   post:
 *     summary: Get wallet transaction details
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GetWalletTransactionRequest'
 *     responses:
 *       200:
 *         description: Transaction details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetWalletTransactionResponse'
 *       400:
 *         description: Invalid transaction details request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Failed to fetch transaction details
 */
router.post("/transactions/details", middleware, getTransactionController);

export default router;
