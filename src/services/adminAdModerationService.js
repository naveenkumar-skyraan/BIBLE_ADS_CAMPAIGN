
import * as model from "../models/adminAdModerationModel.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const actions = {
  block: {
    requiresReason: true,
    invalidMessage: "Only active, currently unblocked ads can be blocked.",
  },
  approve: {
    requiresReason: false,
    invalidMessage: "Only ads under review can be approved.",
  },
  reject: {
    requiresReason: true,
    invalidMessage: "Only ads under review can be rejected.",
  },
};

export const moderateAd = async (action, adId, adminId, reason) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  if (!/^[1-9]\d*$/.test(String(adminId))) {
    throw createError("Invalid admin ID.", 400);
  }

  const config = actions[action];

  if (!config) {
    throw createError("Invalid moderation action.", 400);
  }

  const normalizedReason = typeof reason === "string"
    ? reason.trim()
    : "";

  if (config.requiresReason && !normalizedReason) {
    throw createError("A moderation reason is required.", 400);
  }

  if (normalizedReason.length > 5000) {
    throw createError("Moderation reason cannot exceed 5000 characters.", 400);
  }

  const result = await model.updateAdModeration({
    adId: String(adId),
    adminId: String(adminId),
    action,
    reason: normalizedReason || null,
  });

  if (result.notFound) {
    throw createError("Advertisement not found.", 404);
  }

  if (result.invalidState) {
    throw createError(config.invalidMessage, 409);
  }

  return {
    ad_id: String(adId),
    moderation_status: result.moderationStatus,
    history_id: result.historyId,
  };
};
