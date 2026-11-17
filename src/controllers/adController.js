import * as service from "../services/adService.js";
import { createAdSchema, updateAdSchema } from "../validators/adValidator.js";
import { submitAdForReviewSchema } from "../validators/adModerationValidator.js";
import { cancelAdSchema } from "../validators/adCancellationValidator.js";

import fs from "node:fs/promises";

const validate = (schema, body) => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: false,
    convert: true,
  });

  if (!error) {
    return { value };
  }

  const errors = {};

  for (const detail of error.details) {
    const field = detail.path.join(".");

    if (!errors[field]) {
      errors[field] = detail.message;
    }
  }

  return { errors };
};

const removeUploadedFile = async (file) => {
  if (!file?.path) return;

  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.error("UPLOAD CLEANUP ERROR:", error.message);
  }
};

const handleError = (res, error) => {
  console.error("AD ERROR:", error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Internal server error.",
  });
};

export const createAdController = async (req, res) => {
  const result = validate(createAdSchema, req.body);

  if (result.errors) {
    await removeUploadedFile(req.file);

    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: result.errors,
    });
  }

  try {
    const data = await service.createAd(req.user.id, result.value, req.file);

    return res.status(201).json({
      success: true,
      message: "Draft ad created successfully.",
      data,
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    return handleError(res, error);
  }
};

export const getAdController = async (req, res) => {
  try {
    const data = await service.getAd(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: "Ad fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateAdController = async (req, res) => {
  const result = validate(updateAdSchema, req.body);

  if (result.errors) {
    await removeUploadedFile(req.file);

    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: result.errors,
    });
  }

  try {
    const data = await service.updateAd(
      req.params.id,
      req.user.id,
      result.value,
      req.file,
    );

    return res.status(200).json({
      success: true,
      message: "Advertisement updated successfully.",
      data,
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    return handleError(res, error);
  }
};

export const getAdDetailsController = async (req, res) => {
  try {
    const data = await service.getAdDetails(
      req.params.id,
      req.user.id,
      req.query.period || "this_month",
    );
    return res.status(200).json({
      success: true,
      message: "Ad campaign details retrieved successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getMyAdsController = async (req, res) => {
  try {
    const data = await service.getMyAds(req.user.id, req.body || {});

    return res.status(200).json({
      success: true,
      message: "Ads fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const pauseAdController = async (req, res) => {
  try {
    const data = await service.pauseAd(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: "Ad paused successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const resumeAdController = async (req, res) => {
  try {
    const data = await service.resumeAd(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: "Ad resumed successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const submitAdForReviewController = async (req, res) => {
  const { error, value } = submitAdForReviewSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    await removeUploadedFile(req.file);

    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: error.details.map((detail) => detail.message),
    });
  }

  try {
    const data = await service.submitAdForReview(
      req.params.id,
      req.user.id,
      value,
      req.file,
    );

    return res.status(200).json({
      success: true,
      message: "Ad submitted for review successfully.",
      data,
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    return handleError(res, error);
  }
};

export const getAdModerationHistoryController = async (req, res) => {
  try {
    const data = await service.getAdModerationHistory(
      req.params.id,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: "Ad moderation history fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};


export const cancelAdController = async (req, res) => {
  const result = validate(cancelAdSchema, req.body);

  if (result.errors) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: result.errors,
    });
  }

  try {
    const data = await service.cancelAd(
      req.params.id,
      req.user.id,
      result.value,
    );

    return res.status(200).json({
      success: true,
      message: "Advertisement cancelled successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
