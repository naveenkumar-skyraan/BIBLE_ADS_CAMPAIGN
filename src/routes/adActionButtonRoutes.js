import express from "express";
import * as service from "../services/adActionButtonService.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Ad Action Buttons
 *   description: Public APIs for fetching ad action buttons
 */

/**
 * @swagger
 * /api/ad-action-buttons:
 *   get:
 *     summary: Get active ad action buttons
 *     description: Fetches all active ad action buttons ordered by sort_order.
 *     tags: [Ad Action Buttons]
 *     responses:
 *       200:
 *         description: Ad action buttons fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Learn More
 *                       code:
 *                         type: string
 *                         example: LEARN_MORE
 *                       sort_order:
 *                         type: integer
 *                         example: 1
 *                       is_active:
 *                         type: integer
 *                         example: 1
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error.
 */
router.get("/", async (req, res) => {
  try {
    const data = await service.listActionButtons(false);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("PUBLIC AD ACTION BUTTONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

export default router;
