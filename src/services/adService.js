import db from "../configs/database/db.js";
import * as model from "../models/adModel.js";
import { getCurrencyMetadata } from "../utils/currencyConfig.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateReference = async (table, id, label) => {
  const allowedTables = {
    ad_types: "ad_types",
    ad_objectives: "ad_objectives",
    ad_action_button_types: "ad_action_button_types",
  };

  const safeTable = allowedTables[table];

  if (!safeTable) {
    throw new Error("Invalid reference table.");
  }

  const [rows] = await db.execute(
    `SELECT id FROM ${safeTable}
         WHERE id = ? AND is_active = 1
         LIMIT 1`,
    [id],
  );

  if (rows.length === 0) {
    throw createError(`Selected ${label} is invalid or inactive.`, 400);
  }
};

const validateAdSubtype = async (subtypeId, adTypeId) => {
  const [rows] = await db.execute(
    `SELECT id
         FROM ad_subtypes
         WHERE id = ?
           AND ad_type_id = ?
           AND is_active = 1
         LIMIT 1`,
    [subtypeId, adTypeId],
  );

  if (rows.length === 0) {
    throw createError(
      "Selected ad subtype is invalid, inactive, or does not belong to the selected ad type.",
      400,
    );
  }
};

const prepareAdSubtype = async (adTypeId, subtypeId) => {
  const typeId = Number(adTypeId);

  const [subtypeRows] = await db.execute(
    `SELECT id
     FROM ad_subtypes
     WHERE ad_type_id = ?
       AND is_active = 1
     LIMIT 1`,
    [typeId],
  );

  const hasSubtypes = subtypeRows.length > 0;

  if (!hasSubtypes) {
    return null;
  }

  if (subtypeId == null || subtypeId === "") {
    throw createError("Please select an ad subtype.", 400);
  }

  if (subtypeId != null && subtypeId !== "") {
    const parsedSubtypeId = Number(subtypeId);

    if (!Number.isInteger(parsedSubtypeId) || parsedSubtypeId <= 0) {
      throw createError("Invalid ad subtype.", 400);
    }

    await validateAdSubtype(parsedSubtypeId, typeId);

    return parsedSubtypeId;
  }

  return null;
};

const prepareFile = (file) => {
  if (!file) {
    throw createError("Please upload one image or video.", 400);
  }

  return {
    mediaType: file.mimetype.startsWith("image/") ? "image" : "video",
    fileUrl: `/uploads/ads/${file.filename}`,
    fileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
  };
};

export const createAd = async (userId, data, file) => {
  await validateReference("ad_types", data.ad_type_id, "ad type");

  const adSubtypeId = await prepareAdSubtype(
    data.ad_type_id,
    data.ad_subtype_id,
  );

  await validateReference(
    "ad_objectives",
    data.objective_id,
    "advertising objective",
  );

  if (data.action_button_type_id != null) {
    await validateReference(
      "ad_action_button_types",
      data.action_button_type_id,
      "action button",
    );
  }

  const fileData = prepareFile(file);

  const adData = {
    ...data,
    ad_subtype_id: adSubtypeId,
  };

  const adId = await model.createAd(userId, adData, fileData);

  return model.getAdById(adId, userId);
};

export const getAd = async (adId, userId) => {
  const ad = await model.getAdById(adId, userId);

  if (!ad) {
    throw createError("Ad not found.", 404);
  }

  return ad;
};

export const updateAd = async (adId, userId, data, file) => {
  const existingAd = await model.getAdTypeInfoForUpdate(adId, userId);
  if (!existingAd) {
    throw createError(
      "Ad not found or not editable. Draft, active, paused and completed ads can be edited.",
      404,
    );
  }

  const effectiveAdTypeId = Object.hasOwn(data, "ad_type_id")
    ? data.ad_type_id
    : existingAd.ad_type_id;

  // Validate a newly supplied ad type exactly as we do during creation.
  // Existing ad types are retained for partial updates when the client omits it.
  if (Object.hasOwn(data, "ad_type_id")) {
    await validateReference("ad_types", effectiveAdTypeId, "ad type");
  }

  const effectiveSubtypeId = Object.hasOwn(data, "ad_subtype_id")
    ? data.ad_subtype_id
    : existingAd.ad_subtype_id;

  const validatedSubtypeId = await prepareAdSubtype(
    effectiveAdTypeId,
    effectiveSubtypeId,
  );

  if (data.business_id !== undefined) {
    const [businessRows] = await db.execute(
      `SELECT id FROM business_details
       WHERE id = ? AND user_id = ? AND is_deleted = 0 LIMIT 1`,
      [data.business_id, userId],
    );
    if (!businessRows.length)
      throw createError(
        "Selected business is invalid or does not belong to you.",
        400,
      );
  }
  if (data.objective_id !== undefined) {
    await validateReference(
      "ad_objectives",
      data.objective_id,
      "advertising objective",
    );
  }
  if (data.action_button_type_id != null) {
    await validateReference(
      "ad_action_button_types",
      data.action_button_type_id,
      "action button",
    );
  }

  const updateData = {
    ...data,
    ad_type_id: Number(effectiveAdTypeId),
    ad_subtype_id: validatedSubtypeId,
  };

  const fileData = file ? prepareFile(file) : null;
  const result = await model.updateAd(adId, userId, updateData, fileData);

  if (result.notFound) {
    throw createError(
      "Ad not found or not editable. Draft, active, paused and completed ads can be edited.",
      404,
    );
  }
  return model.getAdById(adId, userId);
};

const normalizePerformancePeriod = (period) => {
  if (
    period === undefined ||
    period === null ||
    String(period).trim() === ""
  ) {
    return "this_month";
  }

  if (typeof period !== "string") {
    throw createError("Invalid performance period.", 400);
  }

  const normalizedPeriod = period.trim().toLowerCase();

  const allowedPeriods = [
    "this_month",
    "this_year",
    "this_week",
    "last_month",
    "last_year",
  ];

  if (!allowedPeriods.includes(normalizedPeriod)) {
    throw createError(
      `Invalid performance period. Allowed values: ${allowedPeriods.join(", ")}.`,
      400,
    );
  }

  return normalizedPeriod;
};

export const getAdDetails = async (adId, userId, period = "this_month") => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  const normalizedPeriod = normalizePerformancePeriod(period);

  const result = await model.getAdDetailsForView(
    adId,
    userId,
    normalizedPeriod,
  );
  if (!result) throw createError("Advertisement details not found.", 404);
  if (result.campaign?.currency_code) {
    const currency = getCurrencyMetadata(result.campaign.currency_code);
    result.campaign.currency_symbol = currency.currency_symbol;
    result.performance.currency_symbol = currency.currency_symbol;
    result.performance.spend_by_currency =
      result.performance.spend_by_currency.map((item) => ({
        ...item,
        currency_symbol: getCurrencyMetadata(item.currency_code)
          .currency_symbol,
      }));
  }
  return result;
};

const AD_STATUSES = ["draft", "active", "paused", "completed", "under_verify"];

export const getMyAds = async (userId, query = {}) => {
  const status = query.status?.trim() || null;
  const search = query.search?.trim() || null;

  if (status && !AD_STATUSES.includes(status)) {
    throw createError("Invalid ad status filter.", 400);
  }

  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 10);

  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }

  const offset = (page - 1) * limit;

  const result = await model.getMyAds(userId, {
    status,
    search,
    limit,
    offset,
  });

  return {
    ads: result.ads,
    pagination: {
      current_page: page,
      per_page: limit,
      total_records: result.total,
      total_pages: Math.ceil(result.total / limit),
    },
  };
};

export const pauseAd = async (adId, userId) => {
  return model.pauseAd(adId, userId);
};

export const resumeAd = async (adId, userId) => {
  return model.resumeAd(adId, userId);
};

export const submitAdForReview = async (adId, userId, data, file) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  const submissionData = {
    email: data.email.trim(),
    updateReason: data.update_reason.trim(),

    documentPath: file ? file.filename : null,

    documentName: file?.originalname ?? null,
    documentMimeType: file?.mimetype ?? null,
    documentSize: file?.size ?? null,
  };

  const result = await model.submitAdForReview(adId, userId, submissionData);

  if (result.notFound) {
    throw createError("Ad not found.", 404);
  }

  if (result.invalidState) {
    throw createError(
      "Only blocked active ads can be resubmitted for review.",
      409,
    );
  }

  return {
    ad_id: String(adId),
    moderation_status: "under_review",
    history_id: result.historyId,
  };
};

export const getAdModerationHistory = async (adId, userId) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  const result = await model.getAdModerationHistory(adId, userId);

  if (!result) {
    throw createError("Advertisement not found.", 404);
  }

  return result;
};

export const deleteAd = async (adId, userId) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  const result = await model.deleteAd(adId, userId);

  if (result.notFound) {
    throw createError("Advertisement or campaign not found.", 404);
  }

  if (result.invalidState) {
    throw createError(
      "Advertisement cannot be deleted in its current state.",
      409,
    );
  }

  return result;
};

export const getAdDeletePreview = async (adId, userId) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }
  const result = await model.getPausedAdDeletePreview(adId, userId);
  if (result.notFound) throw createError("Advertisement or campaign not found.", 404);
  if (result.invalidState) throw createError("Deletion preview is available only for paused advertisements.", 409);
  return result;
};


export const getCancellationReasons = async () => {
  return model.getActiveCancellationReasons();
};

export const cancelAd = async (adId, userId, data) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  const result = await model.cancelActiveAd(adId, userId, {
    reason_id: data.reason_id,
    other_reason: data.other_reason?.trim() || null,
  });

  if (result.notFound) {
    throw createError("Advertisement or campaign not found.", 404);
  }

  if (result.invalidState) {
    throw createError("Only active advertisements can be cancelled.", 409);
  }

  if (result.invalidReason) {
    throw createError(
      "Selected cancellation reason is invalid or inactive. Fetch the active cancellation reasons and try again.",
      400,
    );
  }

  if (result.missingOtherReason) {
    throw createError(
      "Please provide other_reason for the selected cancellation reason.",
      400,
    );
  }

  return result;
};
