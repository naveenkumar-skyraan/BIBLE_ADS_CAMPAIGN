import express from "express";

import { socialLoginController } from "../controllers/socialAuthController.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/social-login:
 *   post:
 *     summary: Social signup or login
 *     description: >
 *       Creates a new user if the social account does not exist,
 *       or logs in the existing user. Returns access and refresh
 *       tokens on success.
 *     tags:
 *       - Social Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - providerUserId
 *               - name
 *               - deviceId
 *               - deviceType
 *             properties:
 *               provider:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *                 description: "1 = Google, 2 = Apple, 3 = Facebook"
 *                 example: 1
 *               providerUserId:
 *                 type: string
 *                 maxLength: 100
 *                 example: "google-user-123456"
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *                 example: "john@example.com"
 *               deviceId:
 *                 type: string
 *                 example: "device-123456"
 *               deviceToken:
 *                 type: string
 *                 nullable: true
 *                 example: "fcm-device-token"
 *               deviceType:
 *                 type: string
 *                 enum: [android, ios]
 *                 example: "android"
 *     responses:
 *       200:
 *         description: Social signup or login successful.
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
 *                   example: Social login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/LoginUserResponse'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Refresh session error.
 *       403:
 *         description: Account deletion is pending.
 *       404:
 *         description: Associated user account was not found.
 *       500:
 *         description: Social login failed.
 */

router.post("/social-login", socialLoginController);

export default router;
