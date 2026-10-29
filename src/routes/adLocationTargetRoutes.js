import { Router } from "express";
import { middleware } from "../middleware/authMiddleware.js";
import adLocationController from "../controllers/adLocationController.js";
import { checkLocationTarget } from "../controllers/adLocationController.js";

const router = Router();

/**
 * @swagger
 * /api/ads/{id}/location-target:
 *   put:
 *     summary: Save or update an ad's geographic targeting
 *     tags:
 *       - Ads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Draft ad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - location_name
 *               - latitude
 *               - longitude
 *               - is_radius_enabled
 *               - radius_km
 *             properties:
 *               place_id:
 *                 type: string
 *                 nullable: true
 *               location_name:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               is_radius_enabled:
 *                 type: boolean
 *               radius_km:
 *                 type: integer
 *                 enum: [5, 10, 20, 40, 60]
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Location target saved successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft ad not found or not owned by the user
 */
router.put("/:id/location-target", middleware, adLocationController.saveTarget);

/**
 * @swagger
 * /api/ads/{id}/location-target:
 *   get:
 *     summary: Retrieve an ad's saved geographic targeting
 *     tags:
 *       - Ads
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
 *         description: Location target retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Location target not found
 */
router.get("/:id/location-target", middleware, adLocationController.getTarget);

/**
 * @swagger
 * /api/ads/{id}/location-target/check:
 *   post:
 *     summary: Check whether a viewer is inside an ad's target radius
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 example: 11.0168
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 example: 76.9558
 *     responses:
 *       200:
 *         description: Location eligibility calculated successfully
 *       400:
 *         description: Invalid coordinates
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ad or saved location target not found
 */
router.post("/:id/location-target/check", middleware, checkLocationTarget);

export default router;
