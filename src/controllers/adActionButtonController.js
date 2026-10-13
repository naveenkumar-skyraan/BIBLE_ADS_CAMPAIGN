import * as service from "../services/adActionButtonService.js";

import {
  createAdActionButtonValidator,
  updateAdActionButtonValidator,
  updateAdActionButtonStatusValidator,
} from "../validators/adActionButtonValidator.js";

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const validationError = new Error(
      error.details.map((detail) => detail.message).join(", "),
    );
    validationError.statusCode = 400;
    throw validationError;
  }

  return value;
};

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode === 500) {
    console.error("AD ACTION BUTTON ERROR:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error." : error.message,
  });
};

export const createActionButton = async (req, res) => {
  try {
    const data = validate(createAdActionButtonValidator, req.body);

    const actionButton = await service.createActionButton(data);

    return res.status(201).json({
      success: true,
      message: "Ad action button type created successfully.",
      data: actionButton,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listActionButtons = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === "true";

    const data = await service.listActionButtons(includeInactive);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getActionButton = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid action button ID is required.",
      });
    }

    const data = await service.getActionButton(id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateActionButton = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid action button ID is required.",
      });
    }

    const data = validate(updateAdActionButtonValidator, req.body);

    const actionButton = await service.editActionButton(id, data);

    return res.status(200).json({
      success: true,
      message: "Ad action button type updated successfully.",
      data: actionButton,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateActionButtonStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid action button ID is required.",
      });
    }

    const data = validate(updateAdActionButtonStatusValidator, req.body);

    const actionButton = await service.changeActionButtonStatus(
      id,
      data.is_active,
    );

    return res.status(200).json({
      success: true,
      message: "Ad action button status updated successfully.",
      data: actionButton,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
