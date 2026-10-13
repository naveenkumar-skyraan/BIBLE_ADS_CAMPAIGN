import express from "express";
import * as service from "../services/adTypeService.js";

const router = express.Router();

/**
 * @swagger
 * /api/ad-types:
 *   get:
 *     summary: Get active ad types
 *     description: Returns all active advertisement types available for ad creation.
 *     tags:
 *       - Ads
 *     responses:
 *       200:
 *         description: Ad types fetched successfully.
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
 *                     $ref: '#/components/schemas/AdTypeResponse'
 *       500:
 *         description: Internal server error.
 */
router.get("/", async (req, res) => {
    try {
        const data = await service.listTypes(false);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("PUBLIC AD TYPES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

export default router;