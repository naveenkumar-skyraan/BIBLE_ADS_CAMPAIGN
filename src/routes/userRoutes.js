import express from "express";

import {
    signupController,
    verifyOtpController,
    resendOtpController,
    loginController,
    refreshTokenController,
    logoutController,
    forgotPasswordController,
    resetPasswordController,
    deleteAccountController
} from "../controllers/userController.js";

import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: OTP generated successfully
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Phone already registered or account deletion pending
 */
router.post("/signup", signupController);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post("/verify-otp", verifyOtpController);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpRequest'
 *     responses:
 *       200:
 *         description: OTP generated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 *       409:
 *         description: Phone already verified or account deletion pending
 */
router.post("/resend-otp", resendOtpController);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Phone number not verified
 *       409:
 *         description: Account deletion pending
 *       410:
 *         description: Account deletion period expired
 */
router.post("/login", loginController);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid refresh token
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post("/refresh-token", refreshTokenController);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.post("/logout", middleware, logoutController);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Generate password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP generated for password reset
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post("/forgot-password", forgotPasswordController);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid reset token
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post("/reset-password", resetPasswordController);

/**
 * @swagger
 * /api/auth/delete-account:
 *   delete:
 *     tags:
 *       - Authentication
 *     summary: Schedule account deletion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteAccountRequest'
 *     responses:
 *       200:
 *         description: Account scheduled for deletion
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid password or unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion already pending
 */
router.delete(
    "/delete-account",middleware,deleteAccountController);

export default router;