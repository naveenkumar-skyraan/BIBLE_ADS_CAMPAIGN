
import path from "node:path";
import fs from "node:fs/promises";

import * as model from "../models/adminAdModerationQueryModel.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const getModerationQueue = async (query = {}) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const search = typeof query.search === "string"
    ? query.search.trim()
    : "";

  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }

  if (search.length > 100) {
    throw createError("Search cannot exceed 100 characters.", 400);
  }

  const offset = (page - 1) * limit;

  const result = await model.getModerationQueue({
    limit,
    offset,
    search,
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

export const getModerationDetails = async (adId) => {
  if (!/^[1-9]\d*$/.test(String(adId))) {
    throw createError("Invalid advertisement ID.", 400);
  }

  const result = await model.getModerationDetails(adId);

  if (!result) {
    throw createError(
      "Advertisement is not currently under review or was not found.",
      404,
    );
  }

  return result;
};

export const getModerationDocument = async (historyId) => {
  if (!/^[1-9]\d*$/.test(String(historyId))) {
    throw createError("Invalid moderation history ID.", 400);
  }

  const record = await model.getModerationDocument(historyId);

  if (!record) {
    throw createError("Moderation document not found.", 404);
  }

  const fileName = record.document_path;

  // Only generated filenames are accepted. Directory paths are never allowed.
  if (
    path.basename(fileName) !== fileName ||
    !/^[a-f0-9-]+\.(pdf|jpg|jpeg|png)$/i.test(fileName)
  ) {
    throw createError("Invalid document reference.", 400);
  }

  const uploadDirectory = path.resolve(
    "private_uploads/ad-moderation",
  );

  const filePath = path.resolve(uploadDirectory, fileName);

  if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) {
    throw createError("Invalid document path.", 400);
  }

  try {
    await fs.access(filePath);
  } catch {
    throw createError("The uploaded document could not be found.", 404);
  }

  return {
    filePath,
    downloadName: path.basename(record.document_name || fileName),
    mimeType: record.document_mime_type,
  };
};
