import express from "express";

import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

import {
  getModerationQueueController,
  getModerationDetailsController,
  downloadModerationDocumentController,
} from "../controllers/adminAdModerationQueryController.js";

import {
  blockAdController,
  approveAdController,
  rejectAdController,
} from "../controllers/adminAdModerationController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Ad Moderation
 *   description: Admin APIs for advertisement moderation and review management
 */

/**
 * @swagger
 * /api/admin/ads/{id}/block:
 *   patch:
 *     summary: Block an active advertisement
 *     tags: [Admin Ad Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Advertisement ID
 *     responses:
 *       200:
 *         description: Advertisement blocked successfully
 *       400:
 *         description: Invalid request or advertisement status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Advertisement not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/block", adminAuthMiddleware, blockAdController);

/**
 * @swagger
 * /api/admin/ads/{id}/approve:
 *   patch:
 *     summary: Approve an advertiser's resubmission
 *     tags: [Admin Ad Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Advertisement ID
 *     responses:
 *       200:
 *         description: Advertisement approved successfully
 *       400:
 *         description: Invalid request or advertisement status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Advertisement not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/approve", adminAuthMiddleware, approveAdController);

/**
 * @swagger
 * /api/admin/ads/{id}/reject:
 *   patch:
 *     summary: Reject an advertiser's resubmission
 *     tags: [Admin Ad Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Advertisement ID
 *     responses:
 *       200:
 *         description: Advertisement rejected successfully
 *       400:
 *         description: Invalid request or advertisement status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Advertisement not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/reject", adminAuthMiddleware, rejectAdController);

/**
 * @swagger
 * /api/admin/ads/moderation-queue:
 *   get:
 *     summary: Get advertisement moderation queue
 *     description: Retrieve advertisements awaiting admin moderation with pagination and search.
 *     tags: [Admin Ad Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search advertisements
 *     responses:
 *       200:
 *         description: Moderation queue retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/moderation-queue",
  adminAuthMiddleware,
  getModerationQueueController,
);

/**
 * @swagger
 * /api/admin/ads/{id}/moderation-details:
 *   get:
 *     summary: Get advertisement moderation details
 *     description: Retrieve full advertisement details and moderation history.
 *     tags: [Admin Ad Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Advertisement ID
 *     responses:
 *       200:
 *         description: Moderation details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Advertisement not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/moderation-details",
  adminAuthMiddleware,
  getModerationDetailsController,
);

/**
 * @swagger
 * /api/admin/ads/moderation-history/{historyId}/document:
 *   get:
 *     summary: Download moderation document
 *     description: Download a private document associated with moderation history.
 *     tags: [Admin Ad Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: historyId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Moderation history ID
 *     responses:
 *       200:
 *         description: Document downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Moderation document not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/moderation-history/:historyId/document",
  adminAuthMiddleware,
  downloadModerationDocumentController,
);

export default router;
