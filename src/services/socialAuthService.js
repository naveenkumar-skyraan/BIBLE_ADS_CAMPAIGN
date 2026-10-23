import {
  findSocialAccount,
  createSocialAccount,
} from "../models/socialAccountModel.js";

import { hasBusinessByUserId } from "../models/businessDetailModel.js";

import {
  findAccountByUserId,
  createAccount,
  updateAccount,
} from "../models/accountModel.js";

import {
  findUserById,
  findUserByEmail,
  createUser,
  updateUserEmailIfEmpty,
  updateUserSocialLogin,
} from "../models/userModel.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const REFRESH_SESSION_DAYS = Number(process.env.JWT_REFRESH_DAYS);

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

const getRefreshSessionExpiry = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_SESSION_DAYS);
  return expiry;
};

const getRemainingSeconds = (expiresAt) => {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();

  if (remainingMs <= 0) return 0;

  return Math.floor(remainingMs / 1000);
};

const createSocialTokens = async (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshSessionExpiry = getRefreshSessionExpiry();
  const remainingSeconds = getRemainingSeconds(refreshSessionExpiry);

  if (remainingSeconds <= 0) {
    const error = new Error(
      "Refresh session has expired. Please log in again.",
    );
    error.code = "INVALID_REFRESH_TOKEN";
    throw error;
  }

  const refreshToken = generateRefreshToken(userId, remainingSeconds);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const { updateRefreshToken } = await import("../models/userModel.js");

  await updateRefreshToken({
    userId,
    refreshToken: refreshTokenHash,
    refreshTokenExpiresAt: refreshSessionExpiry,
  });

  return { accessToken, refreshToken };
};

const throwError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

export const socialLogin = async ({
  provider,
  providerUserId,
  name,
  email = "",
  deviceId,
  deviceToken,
  deviceType,
}) => {
  const normalizedEmail = email?.trim().toLowerCase() || "";

  let socialAccount = await findSocialAccount({
    provider,
    providerUserId,
  });

  let user;

  if (socialAccount) {
    user = await findUserById(socialAccount.user_id);

    if (!user) {
      throwError("User account not found.", "USER_NOT_FOUND");
    }

    if (Number(user.is_account_deleted) === 1) {
      throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
    }

    if (normalizedEmail && !user.email) {
      await updateUserEmailIfEmpty(user.id, normalizedEmail);
      user = await findUserById(user.id);
    }
  } else {
    if (normalizedEmail) {
      user = await findUserByEmail(normalizedEmail);
    }

    if (user) {
      if (Number(user.is_account_deleted) === 1) {
        throwError("Account is pending deletion.", "ACCOUNT_DELETION_PENDING");
      }

      await createSocialAccount({
        userId: user.id,
        provider,
        providerUserId,
      });

      await updateUserSocialLogin({
        userId: user.id,
        provider,
        providerUserId,
      });

      user = await findUserById(user.id);
    } else {
      const userId = await createUser({
        name: name || "",
        phone: null,
        email: normalizedEmail,
        passwordHash: "",
        otp: null,
        otpExpiresAt: null,
        otpPurpose: null,
        isOauthLogin: 1,
        oauthProviderId: providerUserId,
        oauthProvider: provider,
      });

      await createSocialAccount({
        userId,
        provider,
        providerUserId,
      });

      user = await findUserById(userId);
    }
  }

  const account = await findAccountByUserId(user.id);

  if (account) {
    await updateAccount({
      userId: user.id,
      deviceId,
      deviceToken,
      deviceType,
    });
  } else {
    await createAccount({
      userId: user.id,
      deviceId,
      deviceToken,
      deviceType,
    });
  }

  const tokens = await createSocialTokens(user.id);
  const has_business = await hasBusinessByUserId(user.id);

  return {
    user: {
      id: user.id,
      name: user.name || "",
      phone: user.phone || "",
      email: user.email || "",
      has_business,
    },
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  };
};
