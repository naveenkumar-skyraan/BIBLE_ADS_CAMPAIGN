import express from "express";
import { middleware } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import dashboardBodySchema from "../validators/dashboardValidator.js";
import { getDashboardOverviewController } from "../controllers/dashboardController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: User dashboard overview and campaign analytics
 */

/**
 * @swagger
 * /api/dashboard/overview:
 *   post:
 *     summary: Get dashboard overview
 *     description: >
 *       Returns business selection data, impressions, clicks, spend,
 *       campaign status distribution, spend chart data and top-performing
 *       campaigns. Spend and analytics are read from accepted daily spend
 *       records; this endpoint does not calculate or deduct campaign charges.
 *       Base ad spend, platform fee, GST and wallet debit are returned separately.
 *       Currency totals remain separated; aggregate money fields are null when
 *       the selected period contains more than one currency.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               business_id:
 *                 type: integer
 *                 default: 1
 *                 description: Owned business ID. Defaults to the selected business, or the most recently created business.
 *               overview_period:
 *                 type: string
 *                 enum: [this_month, this_year, this_week, last_month, last_year]
 *                 default: this_month
 *               spend_period:
 *                 type: string
 *                 enum: [this_month, this_year, this_week, last_month, last_year]
 *                 default: this_year
 *               timezone:
 *                 type: string
 *                 default: Asia/Kolkata
 *                 description: IANA timezone used to calculate the requested calendar periods.
 *               top_limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 5
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully.
 *       400:
 *         description: Invalid dashboard filters or timezone.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: No business found or requested business is not owned by the user.
 *       500:
 *         description: Failed to retrieve dashboard overview.
 */
router.post(
  "/overview",
  middleware,
  validateRequest(dashboardBodySchema, "body"),
  getDashboardOverviewController,
);

export default router;
