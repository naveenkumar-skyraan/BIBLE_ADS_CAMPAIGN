import express from "express";

import {
  getWalletController,
  createTopupController,
  verifyTopupController,
  cashfreeWebhookController,
  getTransactionsController,
  getTransactionController,
  getTopupsController,
  getTopupController,
  allocateFundController,
  getFundsController,
  getFundController,
  spendFundController,
  requestRefundController,
} from "../controllers/walletController.js";

import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/webhook", cashfreeWebhookController);

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     summary: Get user wallet
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/GetWalletResponse"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", middleware, getWalletController);

/**
 * @swagger
 * /api/wallet/topups:
 *   post:
 *     summary: Create wallet top-up order
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateTopupRequest"
 *     responses:
 *       201:
 *         description: Top-up order created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Cashfree API error
 */
router.post("/topups", middleware, createTopupController);

/**
 * @swagger
 * /api/wallet/topups/verify:
 *   post:
 *     summary: Verify wallet top-up payment
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/VerifyTopupRequest"
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
router.post("/topups/verify", middleware, verifyTopupController);

/**
 * @swagger
 * /api/wallet/topups:
 *   get:
 *     summary: Get wallet top-up history
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Top-ups fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/topups", middleware, getTopupsController);

/**
 * @swagger
 * /api/wallet/topups/{id}:
 *   get:
 *     summary: Get wallet top-up details
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Top-up fetched successfully
 *       404:
 *         description: Top-up not found
 */
router.get("/topups/:id", middleware, getTopupController);

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Transactions fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/transactions", middleware, getTransactionsController);

/**
 * @swagger
 * /api/wallet/transactions/{id}:
 *   get:
 *     summary: Get wallet transaction details
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transaction fetched successfully
 *       404:
 *         description: Transaction not found
 */
router.get("/transactions/:id", middleware, getTransactionController);

/**
 * @swagger
 * /api/wallet/funds:
 *   post:
 *     summary: Allocate wallet funds to an ad
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AllocateFundRequest"
 *     responses:
 *       201:
 *         description: Fund allocated successfully
 *       400:
 *         description: Invalid allocation
 *       404:
 *         description: Business or ad not found
 */
router.post("/funds", middleware, allocateFundController);

/**
 * @swagger
 * /api/wallet/funds:
 *   get:
 *     summary: Get ad fund allocations
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - active
 *             - completed
 *             - refund_pending
 *             - refunded
 *     responses:
 *       200:
 *         description: Ad funds fetched successfully
 */
router.get("/funds", middleware, getFundsController);

/**
 * @swagger
 * /api/wallet/funds/{id}:
 *   get:
 *     summary: Get ad fund details
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Fund fetched successfully
 *       404:
 *         description: Fund not found
 */
router.get("/funds/:id", middleware, getFundController);

/**
 * @swagger
 * /api/wallet/funds/{id}/spend:
 *   post:
 *     summary: Update ad fund spending
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/SpendFundRequest"
 *     responses:
 *       200:
 *         description: Fund spending updated successfully
 *       400:
 *         description: Invalid spending
 *       404:
 *         description: Fund not found
 */
router.post("/funds/:id/spend", middleware, spendFundController);

/**
 * @swagger
 * /api/wallet/funds/{id}/refund-request:
 *   post:
 *     summary: Request refund for unused ad fund
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Refund request submitted successfully
 *       400:
 *         description: Invalid refund status
 *       404:
 *         description: Fund not found
 */
router.post("/funds/:id/refund-request", middleware, requestRefundController);

export default router;
