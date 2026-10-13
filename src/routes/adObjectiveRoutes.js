import express from "express";
import * as service from "../services/adObjectiveService.js";

const router = express.Router();

/**
 * @swagger
 * /api/ad-objectives:
 *   get:
 *     summary: Get active ad objectives
 *     description: Returns all active advertisement objectives available for ad creation.
 *     tags:
 *       - Ads
 *     responses:
 *       200:
 *         description: Ad objectives fetched successfully.
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
 *                     $ref: '#/components/schemas/AdObjective'
 *       500:
 *         description: Internal server error.
 */
router.get("/", async (req, res) => {
    try {
        const data = await service.listObjectives(false);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("PUBLIC AD OBJECTIVES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

export default router;