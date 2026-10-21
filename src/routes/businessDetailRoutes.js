import express from "express";

import businessDetailController from "../controllers/businessDetailController.js";
import locationController from "../controllers/locationController.js";

import { middleware } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  createBusinessSchema,
  updateBusinessSchema,
  businessIdSchema,
  countryCodeSchema,
  locationOptionsSchema,
} from "../validators/businessDetailValidator.js";

const router = express.Router();

router.get("/countries", businessDetailController.getCountries);

router.get(
  "/countries/:country_code",
  validateRequest(countryCodeSchema, "params"),
  businessDetailController.getCountryByCode,
);

/**
 * @swagger
 * /api/business-details/locations/options:
 *   get:
 *     summary: Get location dropdown options
 *     description: Uses the selected country's field configuration and GeoNames records. Data is read from MySQL when matching location rows exist; otherwise, GeoNames is queried and the results are cached.
 *     tags: [Location]
 *     parameters:
 *       - in: query
 *         name: country_code
 *         required: true
 *         schema:
 *           type: string
 *           example: IN
 *       - in: query
 *         name: field
 *         required: true
 *         description: Must be a geographic field configured for this country.
 *         schema:
 *           type: string
 *           enum:
 *             - admin_area_1
 *             - admin_area_2
 *             - city
 *             - area
 *           example: admin_area_1
 *       - in: query
 *         name: parent_id
 *         required: false
 *         description: Internal locations.id of the previously selected geographic option. Required when the requested field follows another geographic field in the country configuration.
 *         schema:
 *           type: integer
 *           example: 15
 *     responses:
 *       200:
 *         description: Location options retrieved successfully
 *       400:
 *         description: Invalid country, field, or parent_id
 *       404:
 *         description: Parent location not found
 *       422:
 *         description: Parent location has no GeoNames ID
 *       502:
 *         description: GeoNames provider request failed
 */
router.get(
  "/locations/options",
  middleware,
  validateRequest(locationOptionsSchema, "query"),
  locationController.getOptions,
);

/**
 * @swagger
 * /api/business-details:
 *   post:
 *     summary: Create business details
 *     tags: [Business Details]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBusinessRequest'
 *     responses:
 *       201:
 *         description: Business details created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  middleware,
  validateRequest(createBusinessSchema, "body"),
  businessDetailController.createBusiness,
);

/**
 * @swagger
 * /api/business-details:
 *   get:
 *     summary: Get all businesses for the authenticated user
 *     tags: [Business Details]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Businesses retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", middleware, businessDetailController.getBusinesses);

/**
 * @swagger
 * /api/business-details/{id}:
 *   get:
 *     summary: Get business details by ID
 *     tags: [Business Details]
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
 *         description: Business details retrieved successfully
 *       400:
 *         description: Invalid business ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.get(
  "/:id",
  middleware,
  validateRequest(businessIdSchema, "params"),
  businessDetailController.getBusinessById,
);

/**
 * @swagger
 * /api/business-details/{id}:
 *   put:
 *     summary: Update business details
 *     tags: [Business Details]
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBusinessRequest'
 *     responses:
 *       200:
 *         description: Business details updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.put(
  "/:id",
  middleware,
  validateRequest(businessIdSchema, "params"),
  validateRequest(updateBusinessSchema, "body"),
  businessDetailController.updateBusiness,
);

/**
 * @swagger
 * /api/business-details/{id}/select:
 *   put:
 *     summary: Select a business for the authenticated user
 *     tags: [Business Details]
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
 *         description: Business selected successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.put(
  "/:id/select",
  middleware,
  validateRequest(businessIdSchema, "params"),
  businessDetailController.selectBusiness,
);

/**
 * @swagger
 * /api/business-details/{id}:
 *   delete:
 *     summary: Delete business details
 *     tags: [Business Details]
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
 *         description: Business details deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.delete(
  "/:id",
  middleware,
  validateRequest(businessIdSchema, "params"),
  businessDetailController.deleteBusiness,
);

export default router;
