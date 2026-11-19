import express from "express";

import { middleware } from "../middleware/authMiddleware.js";
import adUpload from "../middleware/adUpload.js";
import adModerationUpload from "../middleware/adModerationUpload.js";

import { adAnalyticsAuthMiddleware } from "../middleware/adAnalyticsAuthMiddleware.js";

import { submitAdAnalyticsBatchController } from "../controllers/adAnalyticsController.js";

import {
  createAdController,
  getAdController,
  getAdDetailsController,
  deleteAdController,
  getAdDeletePreviewController,
  updateAdController,
  getMyAdsController,
  pauseAdController,
  resumeAdController,
  cancelAdController,
  getAdCancellationReasonsController,
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
 *           example: 15
 *           description: Internal numeric campaign foreign key.
 *         campaign_code:
 *           type: string
 *           nullable: true
 *           example: CMP-48276193
 *           description: Stable, non-sequential public campaign identifier for display.
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
 *         ad_subtype_id:
 *           type: integer
 *           nullable: true
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
 *           enum: [draft, active, paused, completed, under_verify]
 *           example: draft
 *         last_completed_step:
 *           type: integer
 *           minimum: 1
 *           maximum: 3
 *           example: 2
 *           description: Highest wizard step successfully saved (1=ad submission, 2=location, 3=campaign).
 *         resume_step:
 *           type: integer
 *           minimum: 2
 *           maximum: 3
 *           example: 3
 *           description: Next incomplete step, capped at step 3; completed step 3 resumes at step 3.
 *         is_scheduled:
 *           type: boolean
 *           example: false
 *           description: True when the ad is a future-scheduled draft with campaign pricing snapshots.
 *         moderation_status:
 *           type: string
 *           enum: [none, blocked, under_review]
 *           example: none
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
 *               ad_subtype_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional when the ad type has no active subtypes. Required when the ad type has active subtypes; must belong to the selected ad type. Omit this field when no subtype is available.
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
 *     description: >
 *       Returns paginated advertisements. Blocked advertisements are included
 *       in the active listing but are not eligible for delivery. Each item
 *       includes campaign_code for display and campaign_id as the internal
 *       numeric campaign reference.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [all, draft, active, paused, completed, under_verify]
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
 *         description: Ads fetched successfully.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal server error.
 */
router.post("/list", middleware, getMyAdsController);

/**
 * @swagger
 * /api/ads/analytics/batches:
 *   post:
 *     summary: Submit a batch of advertisement impressions and clicks
 *     description: >
 *       Server-to-server endpoint for Android and iOS applications to submit
 *       batched ad impressions and clicks.
 *
 *       Each batch represents one completed half-open Unix interval
 *       [interval_start, interval_end). It must not cross campaign-local
 *       midnight or overlap an accepted interval for the same ad and platform.
 *
 *       A future-ending interval is not stored and may be retried with the same
 *       batch_id and payload after it closes.
 *
 *       A permanently rejected batch is recorded. After correcting the cause,
 *       submit a new batch_id for that interval.
 *
 *       If a batch contains multiple currencies, use currency_totals.
 *       Top-level money totals are null rather than combining unlike currencies.
 *
 *       The backend caps accepted impressions/clicks at the first applicable
 *       daily-budget, lifetime-budget or wallet limit. It stores accepted counts
 *       in impressions/clicks and the submitted counts in reported_impressions/
 *       reported_clicks. A capped response includes mobile_actions; the app must
 *       pause or stop the specified ad immediately. Do not resubmit the discarded
 *       remainder as another batch.
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
 *         description: >
 *           Batch processed or previously processed. processed_items includes
 *           accepted and reported counts, analytics_capped, capping_reason,
 *           limit_reason and mobile_action. mobile_actions instructs the app to
 *           pause or stop ads whose spending limit has been reached.
 *       400:
 *         description: Invalid batch payload.
 *       401:
 *         description: Missing or invalid analytics integration key.
 *       404:
 *         description: Ad, campaign, wallet, business, or pricing snapshot not found.
 *       409:
 *         description: Incomplete future interval, duplicate or overlapping interval, pricing snapshot boundary overlap, invalid campaign state, or moderation/schedule conflict.
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
 * /api/ads/cancellation-reasons:
 *   get:
 *     summary: Get active advertisement cancellation reasons
 *     description: Returns the active cancellation reasons. The mobile app should display reason_text and submit the selected id as reason_id when cancelling an advertisement.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active cancellation reasons fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetAdCancellationReasonsResponse'
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/cancellation-reasons",
  middleware,
  getAdCancellationReasonsController,
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
/**
 * @swagger
 * /api/ads/{id}/details:
 *   get:
 *     summary: Get complete My Ads campaign details
 *     description: Dedicated details endpoint for the Campaign Details screen. This is separate from GET /api/ads/{id}, which remains the Step 1 wizard retrieval endpoint.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: period
 *         description: Performance date range based on the campaign timezone.
 *         schema:
 *           type: string
 *           enum: [this_month, this_year, this_week, last_month, last_year]
 *           default: this_month
 *     responses:
 *       200:
 *         description: Ad, campaign, location and performance details.
 *       404:
 *         description: Advertisement not found.
 */
router.get("/:id/details", middleware, getAdDetailsController);

/**
 * @swagger
 * /api/ads/{id}/delete-preview:
 *   get:
 *     summary: Get deletion preview for a paused advertisement
 *     description: >
 *       Returns campaign budget, amount spent (sum of campaign daily total_charge),
 *       and remaining amount. This endpoint is available only when the ad is paused.
 *       No wallet refund or amount-returned value is calculated. Other ad statuses
 *       should call DELETE /api/ads/{id} directly without this preview.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Advertisement ID
 *     responses:
 *       200:
 *         description: Paused campaign deletion preview fetched successfully.
 *       404:
 *         description: Advertisement or campaign not found.
 *       409:
 *         description: Preview is available only for paused advertisements.
 */
router.get("/:id/delete-preview", middleware, getAdDeletePreviewController);

router.get("/:id", middleware, getAdController);

/**
 * @swagger
 * /api/ads/{id}:
 *   put:
 *     summary: Update an editable advertisement
 *     description: >
 *       Updates draft, active or paused ads. The existing ad status is preserved.
 *       Ad type is immutable after creation; subtype changes must belong to the existing ad type.
 *       If a new media file is provided, it replaces the currently active media.
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
 *                 example: 2
 *                 description: Advertisement type ID.
 *               ad_subtype_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Required only when the selected ad type has active subtypes. Omit this field when the selected ad type has no active subtypes.
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
 *         description: Advertisement updated successfully.
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
 *         description: Ad not found, not owned by the user, or not in an editable status.
 *       500:
 *         description: Internal server error.
 */
router.put("/:id", middleware, adUpload.single("media"), updateAdController);
/**
 * @swagger
 * /api/ads/{id}:
 *   delete:
 *     summary: Delete an advertisement in any lifecycle status
 *     description: >
 *       Soft-deletes the ad and its associated campaign for active, draft, paused,
 *       completed, blocked, and under-review ads. Active ads must include reason_id
 *       from GET /api/ads/cancellation-reasons; other_reason is required when the
 *       selected reason has requires_other=1. Paused ads may first call
 *       GET /api/ads/{id}/delete-preview to display total budget, amount spent,
 *       and remaining amount. The preview is not required for other statuses.
 *       Historical analytics and spend are retained and future billing stops.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Advertisement ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason_id:
 *                 type: integer
 *                 description: Required for active advertisements.
 *               other_reason:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Required when the selected reason requires additional details.
 *           example:
 *             reason_id: 6
 *     responses:
 *       200:
 *         description: Advertisement soft-deleted successfully.
 *       400:
 *         description: Invalid cancellation reason or missing required other_reason.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement or campaign not found.
 *       500:
 *         description: Internal server error.
 */
router.delete("/:id", middleware, deleteAdController);

/**
 * @swagger
 * /api/ads/{id}/campaign:
 *   get:
 *     summary: Retrieve saved campaign details for an advertisement
 *     description: >
 *       Retrieves the campaign configuration saved for the specified ad ID,
 *       including budget, duration, dates, timestamps, timezone, status,
 *       currency, payment summary, and any CPM/CPC pricing snapshots.
 *       Only the authenticated ad owner can retrieve the campaign.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Advertisement ID (not campaign ID)
 *     responses:
 *       200:
 *         description: Campaign details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Campaign details retrieved successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     campaign:
 *                       type: object
 *                       properties:
 *                         ad_id:
 *                           type: integer
 *                           example: 26
 *                         campaign_id:
 *                           type: integer
 *                           example: 16
 *                           description: Internal numeric campaign foreign key.
 *                         campaign_code:
 *                           type: string
 *                           example: CMP-48276193
 *                           description: Public campaign identifier to display in the app.
 *                         id:
 *                           type: integer
 *                           example: 16
 *                         ad_status:
 *                           type: string
 *                           example: draft
 *                         last_completed_step:
 *                           type: integer
 *                           example: 3
 *                         currency_code:
 *                           type: string
 *                           example: INR
 *                         budget_type:
 *                           type: string
 *                           example: daily
 *                         total_budget:
 *                           type: string
 *                           example: "1000.000000"
 *                         daily_budget:
 *                           type: string
 *                           example: "200.000000"
 *                         duration_type:
 *                           type: string
 *                           enum: [days, custom_date]
 *                         duration_days:
 *                           type: integer
 *                           example: 5
 *                         start_date:
 *                           type: string
 *                           nullable: true
 *                           example: "2026-11-20"
 *                         end_date:
 *                           type: string
 *                           nullable: true
 *                           example: "2026-11-24"
 *                         start_timestamp:
 *                           type: integer
 *                           nullable: true
 *                         end_timestamp:
 *                           type: integer
 *                           nullable: true
 *                         timezone:
 *                           type: string
 *                           example: Asia/Kolkata
 *                         status:
 *                           type: string
 *                           example: draft
 *                         is_scheduled:
 *                           type: boolean
 *                           example: false
 *                         pricing_snapshots:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               platform:
 *                                 type: string
 *                                 enum: [android, ios]
 *                               cpm_rate:
 *                                 type: string
 *                               cpc_rate:
 *                                 type: string
 *                               currency_code:
 *                                 type: string
 *                     currency:
 *                       type: object
 *                       properties:
 *                         currency_code:
 *                           type: string
 *                           example: INR
 *                         currency_symbol:
 *                           type: string
 *                           example: ₹
 *                     payment_summary:
 *                       type: object
 *                       properties:
 *                         daily_budget:
 *                           type: string
 *                         duration_days:
 *                           type: integer
 *                         actual_campaign_budget:
 *                           type: string
 *                         platform_fee_percentage:
 *                           type: number
 *                         platform_fee:
 *                           type: string
 *                         gst_percentage:
 *                           type: number
 *                         gst_amount:
 *                           type: string
 *                         total_payable:
 *                           type: string
 *                         currency:
 *                           type: string
 *                     wallet:
 *                       type: object
 *                       properties:
 *                         available_balance:
 *                           type: string
 *                         currency:
 *                           type: string
 *                         maximum_daily_budget:
 *                           type: string
 *                         required_amount:
 *                           type: string
 *                         additional_amount_required:
 *                           type: string
 *                         sufficient_balance:
 *                           type: boolean
 *       400:
 *         description: Invalid advertisement ID or unsupported campaign currency.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Campaign not found, ad not found, or campaign not owned by the authenticated user.
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/:id/campaign",
  middleware,
  adCampaignController.getCampaignDetails,
);

/**
 * @swagger
 * /api/ads/{id}/campaign:
 *   put:
 *     summary: Save or update campaign budget and duration for draft, active or paused campaigns
 *     description: >
 *       Saves campaign budget and duration for draft, active and paused ads.
 *       Active and paused edits preserve the current status, validate the remaining
 *       unspent budget against wallet commitments, and create a new effective pricing
 *       snapshot without changing rates used by previously submitted analytics.
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
 *                 example: days
 *               duration_days:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-20"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-24"
 *     responses:
 *       200:
 *         description: Campaign budget and duration saved.
 *       400:
 *         description: Validation failed or insufficient wallet balance.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Ad or wallet not found.
 *       500:
 *         description: Internal server error.
 */
router.put("/:id/campaign", middleware, adCampaignController.saveCampaign);

// TEMPORARILY DISABLED: campaign estimation API.
// Restore this block when estimates are needed.

/**
 * @swagger
 * /api/ads/{id}/campaign/publish:
 *   post:
 *     summary: Publish a draft campaign or confirm updated published campaign settings
 *     description: >
 *       Publishes a saved draft campaign, validates updated settings for an existing
 *       active or paused campaign, or creates a fresh campaign run when a completed
 *       advertisement is republished through POST /api/ads/{id}/republish.
 *       Active and paused campaigns retain
 *       their current status. Future custom-date draft campaigns remain in draft
 *       status until their scheduled start time. Wallet commitments are validated
 *       transactionally.
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
 *         description: Ad and campaign statuses do not match, or the campaign is not editable.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/:id/campaign/publish",
  middleware,
  adCampaignController.publishCampaign,
);

/**
 * @swagger
 * /api/ads/{id}/republish:
 *   post:
 *     summary: Republish a completed advertisement
 *     description: >
 *       Starts a new campaign run for a completed ad using its previous daily
 *       budget and duration. The new run starts immediately, receives a new
 *       campaign_code, and snapshots the currently applicable CPM/CPC pricing.
 *       The previous completed campaign and spend history are retained.
 *       Blocked or under-review advertisements cannot be republished.
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Advertisement ID
 *     responses:
 *       200:
 *         description: A new campaign run was created and linked to the advertisement.
 *       400:
 *         description: Insufficient wallet balance or no applicable pricing rule.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement, campaign, or wallet not found.
 *       409:
 *         description: Advertisement is not completed, is under moderation, or its currency changed.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/:id/republish",
  middleware,
  adCampaignController.republishCompletedAd,
);

/**
 * @swagger
 * /api/ads/{id}/pause:
 *   put:
 *     summary: Pause an active advertisement
 *     description: >
 *       Pauses an active advertisement owned by the authenticated user.
 *       The advertisement will stop being eligible for delivery.
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
 *         description: Advertisement paused successfully.
 *       400:
 *         description: Advertisement cannot be paused in its current state.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement not found or not owned by the authenticated user.
 *       500:
 *         description: Internal server error.
 */
router.put("/:id/pause", middleware, pauseAdController);

/**
 * @swagger
 * /api/ads/{id}/resume:
 *   put:
 *     summary: Resume a paused advertisement
 *     description: >
 *       Resumes a paused advertisement owned by the authenticated user,
 *       subject to campaign validity, schedule, and wallet requirements.
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
 *         description: Advertisement resumed successfully.
 *       400:
 *         description: Advertisement cannot be resumed or campaign requirements are not satisfied.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement not found or not owned by the authenticated user.
 *       409:
 *         description: Invalid advertisement or campaign state.
 *       500:
 *         description: Internal server error.
 */
router.put("/:id/resume", middleware, resumeAdController);

/**
 * @swagger
 * /api/ads/{id}/cancel:
 *   post:
 *     summary: Cancel an advertisement campaign
 *     description: >
 *       Cancels an advertisement campaign owned by the authenticated user,
 *       subject to the campaign's current state and cancellation rules. A reason_id
 *       from GET /api/ads/cancellation-reasons is required. other_reason is additionally
 *       required when the selected reason has requires_other=1.
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
 *             $ref: '#/components/schemas/CancelAdRequest'
 *           example:
 *             reason_id: 6
 *     responses:
 *       200:
 *         description: Advertisement campaign cancelled successfully.
 *       400:
 *         description: Advertisement cannot be cancelled in its current state.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement or campaign not found.
 *       409:
 *         description: Campaign is already completed or cannot be cancelled.
 *       500:
 *         description: Internal server error.
 */
router.post("/:id/cancel", middleware, cancelAdController);

/**
 * @swagger
 * /api/ads/{id}/retry:
 *   post:
 *     summary: Resubmit a blocked advertisement for moderation review
 *     description: >
 *       Allows the authenticated user to resubmit a blocked advertisement
 *       by providing an email, an explanation of the changes made, and
 *       an optional supporting document.
 *       The advertisement is submitted for moderation review.
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
 *             required:
 *               - email
 *               - update_reason
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: advertiser@example.com
 *               update_reason:
 *                 type: string
 *                 maxLength: 5000
 *                 example: Updated the advertisement content according to moderation guidelines.
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Optional PDF, JPG, or PNG document. Maximum 5 MB.
 *     responses:
 *       200:
 *         description: Advertisement submitted for moderation review successfully.
 *       400:
 *         description: Validation failed or document upload error.
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement not found or not owned by the authenticated user.
 *       409:
 *         description: Advertisement is not currently eligible for resubmission.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/:id/retry",
  middleware,
  adModerationUpload.single("document"),
  submitAdForReviewController,
);

/**
 * @swagger
 * /api/ads/{id}/moderation-history:
 *   get:
 *     summary: Get advertisement moderation history
 *     description: >
 *       Retrieves the moderation history of an advertisement,
 *       including previous review submissions, moderation decisions,
 *       reasons, and supporting document information where available.
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
 *         description: Moderation history retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Moderation history retrieved successfully.
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     additionalProperties: true
 *       401:
 *         description: Missing, invalid, or expired access token.
 *       404:
 *         description: Advertisement not found or not owned by the authenticated user.
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/:id/moderation-history",
  middleware,
  getAdModerationHistoryController,
);

export default router;
