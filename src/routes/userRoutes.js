import express from "express";

import {
  signupController,
  verifyEmailController,
  resendEmailOtpController,
  verifyOtpController,
  resendOtpController,
  loginController,
  refreshTokenController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  deleteAccountController,
  changePasswordController,
  accountDeletionFeedbackController,
} from "../controllers/userController.js";

import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register using name, email, phone number and password
 *     description: Creates a pending account and sends verification OTPs to both email and phone. The account is completed only after both are verified.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: Verification codes sent to email and phone
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email or phone already registered, or account deletion pending
 */
router.post("/signup", signupController);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify email OTP for signup or password reset
 *     description: For signup, email verification alone does not complete registration. Tokens are issued after both email and phone verification are complete.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailRequest'
 *     responses:
 *       200:
 *         description: Email verified or password reset token generated
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post("/verify-email", verifyEmailController);

/**
 * @swagger
 * /api/auth/resend-email-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend email verification or password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendEmailOtpRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post("/resend-email-otp", resendEmailOtpController);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify phone OTP for an authenticated user's profile
 *     description: This route is for profile phone verification, not signup verification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: Phone OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post(
  "/verify-otp",
  (req, res, next) =>
    req.body?.purpose === "profile" ? middleware(req, res, next) : next(),
  verifyOtpController,
);
/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend phone OTP for an authenticated user's profile
 *     description: This route is for profile phone verification, not signup verification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpRequest'
 *     responses:
 *       200:
 *         description: Phone OTP sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Phone already verified or account deletion pending
 */
router.post(
  "/resend-otp",
  (req, res, next) =>
    req.body?.purpose === "profile" ? middleware(req, res, next) : next(),
  resendOtpController,
);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login using email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/LoginUserResponse'
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
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
 *     summary: Generate password reset OTP using email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset OTP sent to email
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
 *     summary: Reset password using a verified reset token
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
 *     responses:
 *       200:
 *         description: Account scheduled for deletion
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion already pending
 */
router.delete("/delete-account", middleware, deleteAccountController);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     tags:
 *       - Authentication
 *     summary: Change the authenticated user's password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation failed or new password is unchanged
 *       401:
 *         description: Current password is incorrect
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.put("/change-password", middleware, changePasswordController);

/**
 * @swagger
 * /api/auth/account-deletion-feedback:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Submit account deletion feedback
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AccountDeletionFeedbackRequest'
 *     responses:
 *       201:
 *         description: Feedback stored successfully
 *       400:
 *         description: Invalid feedback
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Account deletion pending
 */
router.post(
  "/account-deletion-feedback",
  middleware,
  accountDeletionFeedbackController,
);

export default router;
