import { Router } from "express";
import { middleware } from "../middleware/authMiddleware.js";
import adLocationController from "../controllers/adLocationController.js";

const router = Router();

/**
 * @swagger
 * /api/ads/locations/autocomplete:
 *   get:
 *     summary: Search locations using Google Places
 *     tags:
 *       - Ads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: input
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         example: Coimbatore, India
 *     responses:
 *       200:
 *         description: Location suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       place_id:
 *                         type: string
 *                         example: ChIJ...
 *                       description:
 *                         type: string
 *                         example: Coimbatore, Tamil Nadu, India
 *       400:
 *         description: Invalid or missing search input
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Google Places request failed
 */
router.get("/autocomplete", middleware, adLocationController.autocomplete);

/**
 * @swagger
 * /api/ads/locations/place-details/{placeId}:
 *   get:
 *     summary: Get coordinates and address for a Google Place
 *     tags:
 *       - Ads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: placeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Google Place ID returned by autocomplete
 *     responses:
 *       200:
 *         description: Place details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     place_id:
 *                       type: string
 *                       example: ChIJ...
 *                     location_name:
 *                       type: string
 *                       example: Coimbatore, Tamil Nadu, India
 *                     latitude:
 *                       type: number
 *                       format: double
 *                       example: 11.0168
 *                     longitude:
 *                       type: number
 *                       format: double
 *                       example: 76.9558
 *       400:
 *         description: Invalid Place ID
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Google Places request failed
 */
router.get(
  "/place-details/:placeId",
  middleware,
  adLocationController.placeDetails,
);

/**
 * @swagger
 * /api/ads/locations/reverse-geocode:
 *   post:
 *     summary: Convert current GPS coordinates into a readable address
 *     tags:
 *       - Ads
 *     security:
 *       - bearerAuth: []
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
 *         description: Coordinates resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     location_name:
 *                       type: string
 *                       example: Coimbatore, Tamil Nadu, India
 *                     latitude:
 *                       type: number
 *                       example: 11.0168
 *                     longitude:
 *                       type: number
 *                       example: 76.9558
 *       400:
 *         description: Invalid coordinates
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Google Geocoding request failed
 */
router.post(
  "/reverse-geocode",
  middleware,
  adLocationController.reverseGeocode,
);

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
 *                 example: ChIJ...
 *               location_name:
 *                 type: string
 *                 maxLength: 255
 *                 example: Coimbatore, Tamil Nadu, India
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
 *               is_radius_enabled:
 *                 type: boolean
 *                 example: true
 *               radius_km:
 *                 type: integer
 *                 enum: [5, 10, 20, 40, 60]
 *                 nullable: true
 *                 example: 20
 *     responses:
 *       200:
 *         description: Location target saved successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft ad not found or not owned by the user
 *       502:
 *         description: Google location service failed
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
 *         description: Ad ID
 *     responses:
 *       200:
 *         description: Location target retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     ad_id:
 *                       type: integer
 *                     location_name:
 *                       type: string
 *                     place_id:
 *                       type: string
 *                       nullable: true
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     is_radius_enabled:
 *                       type: boolean
 *                     radius_km:
 *                       type: integer
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Location target not found or ad not owned by the user
 */
router.get("/:id/location-target", middleware, adLocationController.getTarget);

export default router;
