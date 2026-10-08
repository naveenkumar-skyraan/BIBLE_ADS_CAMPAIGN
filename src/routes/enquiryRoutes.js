import express from "express";

import {
    createEnquiryController
} from "../controllers/enquiryController.js";

const router = express.Router();

/**
 * @swagger
 * /api/enquiries:
 *   post:
 *     summary: Submit an enquiry
 *     description: Submit a new business enquiry. The enquiry is created with a pending status by default. A duplicate enquiry is rejected if an existing enquiry with the same email, business name, and phone has a pending or contacted status.
 *     tags:
 *       - Enquiries
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEnquiryRequest'
 *     responses:
 *       201:
 *         description: Enquiry submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnquiryResponse'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: An active enquiry already exists for the same email, business name, and phone number
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", createEnquiryController);

export default router;