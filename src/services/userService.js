import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
  findUserByPhone,
  findUserById,
  createUser,
  updateOtp,
  verifyPhone,
  verifyProfilePhone,
  setProfilePhoneForOtp,
  completePendingSignup,
  clearOtp,
  updatePassword,
  updateRefreshToken,
  clearRefreshToken,
  markAccountForDeletion,
  reactivateAccount,
  createAccountDeletionFeedback,
} from "../models/userModel.js";

import { hasBusinessByUserId } from "../models/businessDetailModel.js";

import { sendSmsOTP } from "./sms.js";

const REFRESH_SESSION_DAYS = Number(process.env.JWT_REFRESH_DAYS);

const generateOtp = () => {
  if (process.env.STATIC_OTP?.trim().toLowerCase() === "true") {
    return "1234";
  }

  return crypto.randomInt(1000, 10000).toString();
};

const deliverOtp = async (phone, otp) => {
  if (process.env.STATIC_OTP?.trim().toLowerCase() === "true") {
    return;
  }

  const result = await sendSmsOTP(phone, otp);

  if (result?.return !== true) {
    console.error("SMS request failed:", result);
    throw new Error("Failed to send OTP SMS.");
  }
};

const getOtpExpiry = () => {
  return new Date(Date.now() + 5 * 60 * 1000);
};

const generateAccessToken = (userId) => {
  return jwt.sign(
    {
      sub: userId,
      type: "access",
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    },
  );
};

const generateRefreshToken = (userId, expiresInSeconds) => {
  return jwt.sign(
    {
      sub: userId,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: expiresInSeconds,
    },
  );
};

const hashToken = async (token) => {
  return bcrypt.hash(token, 10);
};

const compareToken = async (token, hashedToken) => {
  return bcrypt.compare(token, hashedToken);
};

const getRefreshSessionExpiry = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_SESSION_DAYS);
  return expiry;
};

const getRemainingSeconds = (expiresAt) => {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.floor(remainingMs / 1000);
};

const createTokens = async (userId, existingRefreshSessionExpiry = null) => {
  const accessToken = generateAccessToken(userId);

  const refreshSessionExpiry = existingRefreshSessionExpiry
    ? new Date(existingRefreshSessionExpiry)
    : getRefreshSessionExpiry();

  const remainingSeconds = getRemainingSeconds(refreshSessionExpiry);

  if (remainingSeconds <= 0) {
    const error = new Error(
      "Refresh session has expired. Please log in again.",
    );
    error.code = "INVALID_REFRESH_TOKEN";
    throw error;
  }

  const refreshToken = generateRefreshToken(userId, remainingSeconds);
  const refreshTokenHash = await hashToken(refreshToken);

  await updateRefreshToken({
    userId,
    refreshToken: refreshTokenHash,
    refreshTokenExpiresAt: refreshSessionExpiry,
  });

  return {
    accessToken,
    refreshToken,
  };
};

const throwError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

export const signup = async ({ name, phone, password }) => {
  const existingUser = await findUserByPhone(phone);

  if (!existingUser) {
    throwError(
      "Phone number must be verified before signup.",
      "PHONE_NOT_VERIFIED",
    );
  }

  if (Number(existingUser.is_account_deleted) === 1) {
    throwError(
      "Account is pending deletion. Please reactivate the account by logging in.",
      "ACCOUNT_DELETION_PENDING",
    );
  }

  if (Number(existingUser.is_phone_verified) !== 1) {
    throwError(
      "Phone number is not verified. Please verify the OTP first.",
      "PHONE_NOT_VERIFIED",
    );
  }

  if (existingUser.password_hash && existingUser.password_hash.trim() !== "") {
    throwError(
      "Phone number is already registered.",
      "PHONE_ALREADY_REGISTERED",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const affectedRows = await completePendingSignup({
    userId: existingUser.id,
    name,
    passwordHash,
  });

  if (affectedRows === 0) {
    throwError(
      "Phone number must be verified before signup.",
      "PHONE_NOT_VERIFIED",
    );
  }

  const tokens = await createTokens(existingUser.id);
  const has_business = await hasBusinessByUserId(existingUser.id);

  return {
    user: {
      id: existingUser.id,
      name,
      phone: existingUser.phone || "",
      email: existingUser.email || "",
      has_business,
    },
    ...tokens,
  };
};

export const verifyOtp = async ({
  phone,
  otp,
  purpose: requestedPurpose,
  userId,
}) => {
  // Profile phone verification: identify the user from the access token.
  if (requestedPurpose === "profile") {
    if (!userId) {
      throwError("Authentication required.", "AUTHENTICATION_REQUIRED");
    }

    const user = await findUserById(userId);

    if (!user) {
      throwError("User not found.", "USER_NOT_FOUND");
    }

    if (Number(user.is_account_deleted) === 1) {
      throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
    }

    if (Number(user.is_oauth_login) !== 1) {
      throwError(
        "Only social login users can add a phone number.",
        "PROFILE_PHONE_NOT_ALLOWED",
      );
    }

    // The submitted phone must match the phone stored during resend-otp.
    if (!user.phone || user.phone !== phone) {
      throwError(
        "Phone number does not match the pending verification.",
        "PHONE_VERIFICATION_MISMATCH",
      );
    }

    if (user.otp_purpose !== "profile" || !user.otp || !user.otp_expires_at) {
      throwError("No active profile OTP found.", "OTP_NOT_FOUND");
    }

    if (new Date(user.otp_expires_at) <= new Date()) {
      throwError("OTP has expired.", "OTP_EXPIRED");
    }

    if (String(user.otp) !== String(otp)) {
      throwError("Invalid OTP.", "INVALID_OTP");
    }

    const affectedRows = await verifyProfilePhone(user.id, phone);

    if (affectedRows === 0) {
      throwError(
        "Phone verification could not be completed. Please request a new OTP.",
        "OTP_NOT_FOUND",
      );
    }

    return { purpose: "profile" };
  }

  // Normal signup and forgot-password verification.
  const user = await findUserByPhone(phone);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
  }

  if (user.otp_purpose !== requestedPurpose) {
    throwError(
      "OTP purpose does not match the request.",
      "INVALID_OTP_PURPOSE",
    );
  }

  if (requestedPurpose === "signup" && Number(user.is_phone_verified) === 1) {
    throwError("Phone number is already verified.", "PHONE_ALREADY_VERIFIED");
  }

  if (!user.otp || !user.otp_expires_at) {
    throwError("No active OTP found.", "OTP_NOT_FOUND");
  }

  if (new Date(user.otp_expires_at) <= new Date()) {
    throwError("OTP has expired.", "OTP_EXPIRED");
  }

  if (String(user.otp) !== String(otp)) {
    throwError("Invalid OTP.", "INVALID_OTP");
  }

  if (requestedPurpose === "signup") {
    await verifyPhone(user.id);
    return { purpose: "signup" };
  }

  if (requestedPurpose === "forgot_password") {
    await clearOtp(user.id);

    const resetToken = jwt.sign(
      {
        sub: user.id,
        type: "password_reset",
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "10m" },
    );

    return {
      purpose: "forgot_password",
      resetToken,
    };
  }

  throwError("Invalid OTP purpose.", "INVALID_OTP_PURPOSE");
};

export const resendOtp = async ({ phone, purpose, userId }) => {
  let user;

  if (purpose === "profile") {
    if (!userId) {
      throwError("Authentication required.", "AUTHENTICATION_REQUIRED");
    }

    user = await findUserById(userId);

    if (!user) {
      throwError("User not found.", "USER_NOT_FOUND");
    }

    if (Number(user.is_account_deleted) === 1) {
      throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
    }

    if (Number(user.is_oauth_login) !== 1) {
      throwError(
        "Only social login users can add a phone number.",
        "PROFILE_PHONE_NOT_ALLOWED",
      );
    }

    const existingPhoneUser = await findUserByPhone(phone);

    if (existingPhoneUser && Number(existingPhoneUser.id) !== Number(user.id)) {
      throwError(
        "Phone number is already registered.",
        "PHONE_ALREADY_REGISTERED",
      );
    }

    if (user.phone === phone && Number(user.is_phone_verified) === 1) {
      throwError("Phone number is already verified.", "PHONE_ALREADY_VERIFIED");
    }

    await setProfilePhoneForOtp(user.id, phone);
  } else {
    user = await findUserByPhone(phone);

    if (!user && purpose === "signup") {
      const newUserId = await createUser({
        name: "",
        phone,
        passwordHash: "",
        otpPurpose: null,
      });

      user = await findUserById(newUserId);
    }

    if (!user) {
      throwError("User not found.", "USER_NOT_FOUND");
    }

    if (Number(user.is_account_deleted) === 1) {
      throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
    }

    if (purpose === "signup" && Number(user.is_phone_verified) === 1) {
      throwError("Phone number is already verified.", "PHONE_ALREADY_VERIFIED");
    }
  }

  const otp = generateOtp();
  const otpExpiresAt = getOtpExpiry();

  await updateOtp({
    userId: user.id,
    otp,
    otpExpiresAt,
    otpPurpose: purpose,
  });

  await deliverOtp(phone, otp);

  return { otp };
};

export const login = async ({ phone, password, reactivate }) => {
  const user = await findUserByPhone(phone);

  if (!user) {
    throwError("Invalid phone number or password.", "INVALID_CREDENTIALS");
  }

  if (!user.password_hash) {
    throwError("Invalid phone number or password.", "INVALID_CREDENTIALS");
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    throwError("Invalid phone number or password.", "INVALID_CREDENTIALS");
  }

  if (Number(user.is_account_deleted) === 1) {
    const deletionDate = new Date(user.account_deleted_at);
    const expiryDate = new Date(
      deletionDate.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    if (new Date() > expiryDate) {
      throwError(
        "Account deletion period has expired.",
        "ACCOUNT_DELETION_EXPIRED",
      );
    }

    if (!reactivate) {
      throwError(
        "Account is pending deletion. Reactivation is required to continue.",
        "ACCOUNT_DELETION_PENDING",
      );
    }

    await reactivateAccount(user.id);
  }

  if (Number(user.is_phone_verified) !== 1) {
    throwError("Phone number is not verified.", "PHONE_NOT_VERIFIED");
  }

  const tokens = await createTokens(user.id);
  const has_business = await hasBusinessByUserId(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone || "",
      email: user.email || "",
      has_business,
    },
    ...tokens,
  };
};

export const refreshAccessToken = async (refreshToken) => {
  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throwError("Invalid or expired refresh token.", "INVALID_REFRESH_TOKEN");
  }

  if (decoded.type !== "refresh") {
    throwError("Invalid refresh token.", "INVALID_REFRESH_TOKEN");
  }

  const user = await findUserById(decoded.sub);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
  }

  if (!user.refresh_token || !user.refresh_token_expires_at) {
    throwError("Refresh token is no longer valid.", "INVALID_REFRESH_TOKEN");
  }

  if (new Date(user.refresh_token_expires_at) <= new Date()) {
    await clearRefreshToken(user.id);
    throwError(
      "Refresh session has expired. Please log in again.",
      "INVALID_REFRESH_TOKEN",
    );
  }

  const validStoredToken = await compareToken(refreshToken, user.refresh_token);

  if (!validStoredToken) {
    await clearRefreshToken(user.id);
    throwError(
      "Refresh token reuse detected. Please log in again.",
      "INVALID_REFRESH_TOKEN",
    );
  }

  return {
    accessToken: generateAccessToken(user.id),
  };
};

export const logout = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  await clearRefreshToken(userId);
};

export const forgotPassword = async (phone) => {
  const user = await findUserByPhone(phone);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
  }

  const otp = generateOtp();
  const otpExpiresAt = getOtpExpiry();

  await updateOtp({
    userId: user.id,
    otp,
    otpExpiresAt,
    otpPurpose: "forgot_password",
  });

  await deliverOtp(phone, otp);

  return {
    otp,
  };
};

export const resetPassword = async ({ reset_token, password }) => {
  let decoded;

  try {
    decoded = jwt.verify(reset_token, process.env.JWT_ACCESS_SECRET);
  } catch (jwtError) {
    console.error("RESET TOKEN ERROR:", jwtError.name, jwtError.message);
    throwError("Invalid or expired reset token.", "INVALID_RESET_TOKEN");
  }

  if (decoded.type !== "password_reset") {
    throwError("Invalid reset token.", "INVALID_RESET_TOKEN");
  }

  const user = await findUserById(decoded.sub);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await updatePassword(user.id, passwordHash);
  await clearRefreshToken(user.id);
};

export const deleteAccount = async ({ userId }) => {
  const user = await findUserById(userId);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError(
      "Account is already pending deletion.",
      "ACCOUNT_DELETION_PENDING",
    );
  }

  await markAccountForDeletion(userId);
};

export const changePassword = async ({
  userId,
  currentPassword,
  newPassword,
}) => {
  const user = await findUserById(userId);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
  }

  const passwordValid = await bcrypt.compare(
    currentPassword,
    user.password_hash,
  );

  if (!passwordValid) {
    throwError("Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
  }

  const samePassword = await bcrypt.compare(newPassword, user.password_hash);

  if (samePassword) {
    throwError(
      "New password must differ from the current password.",
      "PASSWORD_UNCHANGED",
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await updatePassword(userId, passwordHash);
  await clearRefreshToken(userId);
};

export const submitAccountDeletionFeedback = async ({
  userId,
  reason,
  other_reason,
}) => {
  const user = await findUserById(userId);

  if (!user) {
    throwError("User not found.", "USER_NOT_FOUND");
  }

  if (Number(user.is_account_deleted) === 1) {
    throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
  }

  const feedbackId = await createAccountDeletionFeedback({
    userId,
    reason,
    otherReason: other_reason,
  });

  return { feedbackId };
};
