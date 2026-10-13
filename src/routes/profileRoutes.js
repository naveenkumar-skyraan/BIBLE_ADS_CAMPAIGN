
import express from "express";

import {
    getProfileController,
    updateProfileController
} from "../controllers/profileController.js";

import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/settings/profile:
 *   get:
 *     tags:
 *       - Settings-Profile
 *     summary: Get authenticated user's profile
 *     description: Fetches the profile details of the currently authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
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
 *                   example: Profile fetched successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ProfileResponse'
 *       401:
 *         description: Unauthorized or invalid access token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/profile", middleware, getProfileController);

/**
 * @swagger
 * /api/settings/profile:
 *   put:
 *     tags:
 *       - Settings-Profile
 *     summary: Update authenticated user's profile
 *     description: Updates the name, phone number, and optional email of the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           example:
 *             name: Naveen Kumar
 *             phone: "9876543210"
 *             email: yourmail@gmail.com
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: Profile updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ProfileResponse'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized or invalid access token
 *       404:
 *         description: User not found
 *       409:
 *         description: Phone number is already registered
 *       500:
 *         description: Internal server error
 */
router.put("/profile", middleware, updateProfileController);

export default router;
