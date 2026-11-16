import express from "express";

import { middleware } from "../middleware/authMiddleware.js";
import adUpload from "../middleware/adUpload.js";
import adModerationUpload from "../middleware/adModerationUpload.js";

import { adAnalyticsAuthMiddleware } from "../middleware/adAnalyticsAuthMiddleware.js";

import { submitAdAnalyticsBatchController } from "../controllers/adAnalyticsController.js";

import {
  createAdController,
  getAdController,
  updateAdController,
  getMyAdsController,
  pauseAdController,
  resumeAdController,
  cancelAdController,
  submitAdForReviewController,
  getAdModerationHistoryController,
} from "../controllers/adController.js";

import adCampaignController from "../controllers/adCampaignController.js";

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
 *           enum: [draft, active, paused, completed]
 *         moderation_status:
 *           type: string
 *           enum: [none, blocked, under_review]
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
 * /api/ads/list:
 *   post:
 *     summary: Get authenticated user's advertisements
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     description: Returns paginated advertisements with ad listing status and individual campaign status.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, active, paused, completed, under_verify]
 *                 example: active
 *               search:
 *                 type: string
 *                 example: Youth
 *               page:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 *               limit:
 *                 type: integer
 *                 default: 10
 *                 example: 10
 *     responses:
 *       200:
 *         description: Ads fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/list", middleware, getMyAdsController);

/**
 * @swagger
 * /api/ads/analytics/batches:
 *   post:
 *     summary: Submit a batch of advertisement impressions and clicks
 *     description: >
 *      Server-to-server endpoint for Android and iOS applications to submit batched ad impressions and clicks.
 *      Each batch represents one completed half-open Unix interval [interval_start, interval_end); it must not cross campaign-local midnight or overlap an accepted interval for the same ad and platform.
 *      A future-ending interval is not stored and may be retried with the same batch_id and payload after it closes. A permanently rejected batch is recorded; after correcting the cause, submit a new batch_id for that interval.
 *      If a batch contains multiple currencies, use currency_totals; top-level money totals are null rather than combining unlike currencies.
 *     tags: [Ad Analytics]
 *     parameters:
 *       - in: header
 *         name: x-ad-analytics-key
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform-specific integration key configured on the server.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - batch_id
 *               - platform
 *               - interval_start
 *               - interval_end
 *               - items
 *             properties:
 *               batch_id:
 *                 type: string
 *                 format: uuid
 *               platform:
 *                 type: string
 *                 enum: [android, ios]
 *               app_instance_id:
 *                 type: string
 *                 nullable: true
 *               app_version:
 *                 type: string
 *                 nullable: true
 *               interval_start:
 *                 type: integer
 *                 description: Inclusive Unix timestamp in seconds.
 *               interval_end:
 *                 type: integer
 *                 description: Exclusive Unix timestamp in seconds.
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [ad_id, impressions, clicks]
 *                   properties:
 *                     ad_id:
 *                       type: integer
 *                     impressions:
 *                       type: integer
 *                       minimum: 0
 *                     clicks:
 *                       type: integer
 *                       minimum: 0
 *           example:
 *             batch_id: "b1a20f4e-3c0d-4af0-8a12-44c9b88910cd"
 *             platform: android
 *             app_instance_id: "android-install-001"
 *             app_version: "1.4.0"
 *             interval_start: 1794636000
 *             interval_end: 1794636300
 *             items:
 *               - ad_id: 42
 *                 impressions: 120
 *                 clicks: 8
 *     responses:
 *       200:
 *         description: Batch processed successfully or previously processed. Response includes per-ad charges and currency_totals; top-level money totals are populated only for single-currency batches.
 *       400:
 *         description: Invalid batch payload.
 *       401:
 *         description: Missing or invalid analytics integration key.
 *       404:
 *         description: Ad, campaign, wallet, business, or pricing snapshot not found.
 *       409:
 *         description: Incomplete future interval (not persisted and retryable with the same batch_id), duplicate/overlapping interval, invalid campaign state, or a persisted budget/wallet rejection.
 *       503:
 *         description: Analytics integration key is not configured for the requested platform.
 */
router.post(
  "/analytics/batches",
  adAnalyticsAuthMiddleware,
  submitAdAnalyticsBatchController,
);

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

/**
 * @swagger
 * /api/ads/{id}/campaign:
 *   put:
 *     summary: Save campaign budget and duration
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - daily_budget
 *               - duration_type
 *             properties:
 *               daily_budget:
 *                 type: number
 *                 minimum: 100
 *                 example: 200
 *               duration_type:
 *                 type: string
 *                 enum: [days, custom_date]
 *               duration_days:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-10"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-14"
 *     responses:
 *       200:
 *         description: Campaign budget and duration saved.
 *       400:
 *         description: Validation failed or insufficient wallet balance.
 *       404:
 *         description: Ad or wallet not found.
 */
router.put("/:id/campaign", middleware, adCampaignController.saveCampaign);

// TEMPORARILY DISABLED: campaign estimation API. Restore this block when estimates are needed.
// /**
//  * @swagger
//  * /api/ads/{id}/campaign/estimation:
//  *   get:
//  *     summary: Get estimated campaign performance
//  *     description: >
//  *       Retrieves estimated impressions, reach, and video views for a saved
//  *       draft campaign based on its objective, ad type, media type, and
//  *       actual campaign budget and the currency-specific CPM pricing snapshot.
//  *       Platform fees and GST are excluded from estimated impressions and reach.
//  *     tags: [Ads]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Advertisement ID
//  *     responses:
//  *       200:
//  *         description: Campaign estimation retrieved successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: Campaign estimation retrieved successfully.
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     currency:
//  *                       type: string
//  *                       example: INR
//  *                     media_type:
//  *                       type: string
//  *                       enum: [image, video]
//  *                     estimated_impressions:
//  *                       type: integer
//  *                       example: 25000
//  *                     estimated_reach:
//  *                       type: integer
//  *                       example: 10000
//  *                     estimated_views:
//  *                       type: integer
//  *                       nullable: true
//  *                       example: 8750
//  *                     assumptions:
//  *                       type: object
//  *                       properties:
//  *                         estimated_cpm:
//  *                           type: number
//  *                           example: 100
//  *                         average_frequency:
//  *                           type: number
//  *                           example: 2.5
//  *                         video_view_rate:
//  *                           type: number
//  *                           nullable: true
//  *                           example: 0.35
//  *       400:
//  *         description: Invalid advertisement ID or estimation inputs.
//  *       401:
//  *         description: Missing, invalid, or expired access token.
//  *       404:
//  *         description: Draft campaign not found.
//  *       500:
//  *         description: Internal server error.
//  */
//
// router.get(
//   "/:id/campaign/estimation",
//   middleware,
//   adCampaignController.getCampaignEstimation,
// );

/**
 * @swagger
 * /api/ads/{id}/campaign/publish:
 *   post:
 *     summary: Publish a draft campaign
 *     description: >
 *       Publishes a saved campaign. Generates exact start and end timestamps
 *       using the configured campaign timezone. Future custom-date campaigns
 *       remain in draft status until their scheduled start time. Publishing
 *       validates the global wallet against the remaining commitments of all
 *       previously published campaigns for the same user.
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
 *         description: Campaign published or scheduled successfully.
 *       400:
 *         description: Invalid campaign or insufficient global wallet balance.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Draft campaign, advertisement, or wallet not found.
 *       409:
 *         description: Campaign has already been scheduled or published.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/:id/campaign/publish",
  middleware,
  adCampaignController.publishCampaign,
);

router.put("/:id/pause", middleware, pauseAdController);

router.put("/:id/resume", middleware, resumeAdController);

router.post("/:id/cancel", middleware, cancelAdController);

/**
 * @swagger
 * /api/ads/{id}/retry:
 *   post:
 *     summary: Resubmit a blocked advertisement for review
 *     tags: [Ads]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - update_reason
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               update_reason:
 *                 type: string
 *                 maxLength: 5000
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Optional PDF, JPG or PNG document; maximum 5 MB.
 *     responses:
 *       200:
 *         description: Advertisement submitted for review.
 *       400:
 *         description: Validation or upload error.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Advertisement not found.
 *       409:
 *         description: Advertisement is not currently blocked.
 */
router.post(
  "/:id/retry",
  middleware,
  adModerationUpload.single("document"),
  submitAdForReviewController,
);

router.get(
  "/:id/moderation-history",
  middleware,
  getAdModerationHistoryController,
);

export default router;
