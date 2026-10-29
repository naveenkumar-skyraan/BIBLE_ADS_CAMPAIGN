import express from "express";

import { middleware } from "../middleware/authMiddleware.js";
import adUpload from "../middleware/adUpload.js";

import {
  createAdController,
  getAdController,
  updateAdController,
} from "../controllers/adController.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AdMediaResponse:
 *       type: object
 *       properties:
 *         media_id:
 *           type: integer
 *           example: 12
 *         media_type:
 *           type: string
 *           enum: [image, video]
 *           example: image
 *         file_url:
 *           type: string
 *           example: /uploads/ads/abc123.jpg
 *         file_name:
 *           type: string
 *           example: youth-meeting.jpg
 *         mime_type:
 *           type: string
 *           example: image/jpeg
 *         file_size:
 *           type: integer
 *           example: 245678
 *
 *     AdResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 15
 *         campaign_id:
 *           type: integer
 *           nullable: true
 *           example: null
 *         user_id:
 *           type: integer
 *           example: 3
 *         business_id:
 *           type: integer
 *           example: 1
 *         objective_id:
 *           type: integer
 *           example: 1
 *         ad_type_id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: Youth meeting
 *         description:
 *           type: string
 *           example: Join us for an exciting youth meeting.
 *         action_button_type_id:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         destination_link:
 *           type: string
 *           nullable: true
 *           example: https://example.com/reading
 *         platform:
 *           type: string
 *           enum: [android, ios, both]
 *           example: both
 *         status:
 *           type: string
 *           enum: [draft, active, paused, completed, cancelled]
 *           example: draft
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         media_id:
 *           type: integer
 *           nullable: true
 *           example: 12
 *         media_type:
 *           type: string
 *           nullable: true
 *           enum: [image, video]
 *           example: image
 *         file_url:
 *           type: string
 *           nullable: true
 *           example: /uploads/ads/abc123.jpg
 *         file_name:
 *           type: string
 *           nullable: true
 *           example: youth-meeting.jpg
 *         mime_type:
 *           type: string
 *           nullable: true
 *           example: image/jpeg
 *         file_size:
 *           type: integer
 *           nullable: true
 *           example: 245678
 *
 *     AdSingleResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Draft ad created successfully.
 *         data:
 *           $ref: '#/components/schemas/AdResponse'
 *
 *     AdValidationError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Validation failed.
 *         errors:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           example:
 *             title: '"title" is required'
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/ads:
 *   post:
 *     summary: Create a draft advertisement
 *     description: >
 *       Creates an advertisement and uploads exactly one image or video.
 *       The ad is saved as a draft. No wallet deduction or campaign creation
 *       occurs during this operation.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - business_id
 *               - objective_id
 *               - title
 *               - description
 *               - ad_type_id
 *               - platform
 *               - media
 *             properties:
 *               business_id:
 *                 type: integer
 *                 example: 1
 *               objective_id:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 example: Youth meeting
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Join us for an exciting youth meeting.
 *               ad_type_id:
 *                 type: integer
 *                 example: 1
 *               action_button_type_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *               destination_link:
 *                 type: string
 *                 nullable: true
 *                 example: https://example.com/reading
 *               platform:
 *                 type: string
 *                 enum: [android, ios, both]
 *                 example: both
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: One JPG, PNG, WebP, MP4, WebM, or MOV file; maximum 500 MB.
 *     responses:
 *       201:
 *         description: Draft ad created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdSingleResponse'
 *       400:
 *         description: Validation failed, invalid reference, or missing media.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdValidationError'
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       500:
 *         description: Internal server error.
 */
router.post("/", middleware, adUpload.single("media"), createAdController);

/**
 * @swagger
 * /api/ads/{id}:
 *   get:
 *     summary: Get an advertisement by ID
 *     description: Returns an ad owned by the authenticated user, including its active media.
 *     tags: [Ads]
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
 *         description: Advertisement fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdSingleResponse'
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement not found or not owned by the authenticated user.
 *       500:
 *         description: Internal server error.
 */
router.get("/:id", middleware, getAdController);

/**
 * @swagger
 * /api/ads/{id}:
 *   put:
 *     summary: Update a draft advertisement
 *     description: >
 *       Updates the supplied ad fields. If a new media file is provided,
 *       it replaces the currently active media. Only draft ads can be updated.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Advertisement ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               business_id:
 *                 type: integer
 *                 example: 1
 *               objective_id:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 example: Updated youth meeting
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Updated advertisement description.
 *               ad_type_id:
 *                 type: integer
 *                 example: 1
 *               action_button_type_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *               destination_link:
 *                 type: string
 *                 nullable: true
 *                 example: https://example.com/reading
 *               platform:
 *                 type: string
 *                 enum: [android, ios, both]
 *                 example: both
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: Optional replacement image or video; maximum 500 MB.
 *     responses:
 *       200:
 *         description: Draft ad updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdSingleResponse'
 *       400:
 *         description: Validation failed or invalid reference.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdValidationError'
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Draft ad not found or not owned by the authenticated user.
 *       500:
 *         description: Internal server error.
 */
router.put("/:id", middleware, adUpload.single("media"), updateAdController);

export default router;
