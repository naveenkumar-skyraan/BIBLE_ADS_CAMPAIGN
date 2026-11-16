
import express from "express";
import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

import {
    createPricingRuleController,
    listPricingRulesController,
    getPricingRuleController,
    updatePricingRuleController,
    updatePricingRuleStatusController
} from "../controllers/adminPricingController.js";

const router = express.Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   name: Admin Pricing
 *   description: Admin APIs for managing advertisement pricing rules
 */

/**
 * @swagger
 * /api/admin/pricing:
 *   post:
 *     summary: Create a pricing rule
 *     description: Creates a pricing rule. NULL objective, ad type and country values represent a default rule across those scopes.
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - billing_model
 *               - platform
 *               - currency_code
 *               - rate
 *               - effective_from
 *             properties:
 *               objective_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *                 description: Null applies to all objectives
 *               ad_type_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *                 description: Null applies to all ad types
 *               ad_subtype_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               billing_model:
 *                 type: string
 *                 enum: [cpm, cpc]
 *                 example: cpm
 *               country_code:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *                 description: Null applies to all countries using this currency
 *               admin_area_1:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               city:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               platform:
 *                 type: string
 *                 enum: [all, android, ios]
 *                 example: all
 *               currency_code:
 *                 type: string
 *                 example: INR
 *               rate:
 *                 type: number
 *                 format: double
 *                 example: 50
 *               effective_from:
 *                 type: string
 *                 example: "2026-11-12 00:00:00"
 *               effective_until:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               is_active:
 *                 type: integer
 *                 enum: [0, 1]
 *                 default: 1
 *                 example: 1
 *     responses:
 *       201:
 *         description: Pricing rule created successfully
 *       400:
 *         description: Invalid input or inactive reference data
 *       401:
 *         description: Unauthorized - admin authentication required
 *       409:
 *         description: An overlapping pricing rule already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", createPricingRuleController);

/**
 * @swagger
 * /api/admin/pricing/filter:
 *   post:
 *     summary: Filter pricing rules
 *     description: Retrieves pricing rules using pagination, search and optional filters supplied in the JSON request body. An empty body returns all pricing rules.
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               page:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *                 example: 1
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 default: 10
 *                 example: 10
 *               search:
 *                 type: string
 *                 example: INR
 *                 description: Searches objective, ad type, subtype, country and currency
 *               objective_id:
 *                 type: integer
 *                 example: 1
 *               ad_type_id:
 *                 type: integer
 *                 example: 2
 *               ad_subtype_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 3
 *               billing_model:
 *                 type: string
 *                 enum: [cpm, cpc]
 *                 example: cpm
 *               country_code:
 *                 type: string
 *                 example: IN
 *               admin_area_1:
 *                 type: string
 *                 example: Tamil Nadu
 *               city:
 *                 type: string
 *                 example: Chennai
 *               platform:
 *                 type: string
 *                 enum: [all, android, ios]
 *                 example: all
 *               is_active:
 *                 type: integer
 *                 enum: [0, 1]
 *                 example: 1
 *           example:
 *             page: 1
 *             limit: 10
 *             billing_model: cpm
 *             country_code: IN
 *             platform: all
 *             is_active: 1
 *     responses:
 *       200:
 *         description: Pricing rules retrieved successfully
 *       400:
 *         description: Invalid filter parameters
 *       401:
 *         description: Unauthorized - admin authentication required
 *       500:
 *         description: Internal server error
 */
router.post("/filter", listPricingRulesController);

/**
 * @swagger
 * /api/admin/pricing/{id}:
 *   get:
 *     summary: Get a pricing rule by ID
 *     description: Retrieves the details of a specific pricing rule.
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Pricing rule ID
 *     responses:
 *       200:
 *         description: Pricing rule retrieved successfully
 *       400:
 *         description: Invalid pricing rule ID
 *       401:
 *         description: Unauthorized - admin authentication required
 *       404:
 *         description: Pricing rule not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", getPricingRuleController);

/**
 * @swagger
 * /api/admin/pricing/{id}:
 *   put:
 *     summary: Update a pricing rule
 *     description: Updates the configuration of an existing pricing rule.
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Pricing rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - billing_model
 *               - platform
 *               - currency_code
 *               - rate
 *               - effective_from
 *               - effective_until
 *             properties:
 *               objective_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               ad_type_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               ad_subtype_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               billing_model:
 *                 type: string
 *                 enum: [cpm, cpc]
 *                 example: cpm
 *               country_code:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               admin_area_1:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               city:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               platform:
 *                 type: string
 *                 enum: [all, android, ios]
 *                 example: all
 *               currency_code:
 *                 type: string
 *                 example: INR
 *               rate:
 *                 type: number
 *                 format: double
 *                 example: 50
 *               effective_from:
 *                 type: string
 *                 example: "2026-11-12 00:00:00"
 *               effective_until:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *     responses:
 *       200:
 *         description: Pricing rule updated successfully
 *       400:
 *         description: Invalid input or inactive reference data
 *       401:
 *         description: Unauthorized - admin authentication required
 *       404:
 *         description: Pricing rule not found
 *       409:
 *         description: An overlapping pricing rule already exists
 *       500:
 *         description: Internal server error
 */
router.put("/:id", updatePricingRuleController);

/**
 * @swagger
 * /api/admin/pricing/{id}/status:
 *   put:
 *     summary: Update pricing rule status
 *     description: Activates or deactivates a pricing rule.
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Pricing rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: integer
 *                 enum: [0, 1]
 *                 example: 1
 *     responses:
 *       200:
 *         description: Pricing rule status updated successfully
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized - admin authentication required
 *       404:
 *         description: Pricing rule not found
 *       409:
 *         description: Cannot activate because an overlapping pricing rule exists
 *       500:
 *         description: Internal server error
 */
router.put("/:id/status", updatePricingRuleStatusController);

export default router;
