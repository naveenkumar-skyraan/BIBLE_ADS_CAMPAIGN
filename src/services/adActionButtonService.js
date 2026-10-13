import * as model from "../models/adActionButtonModel.js";

const notFound = () => {
  const error = new Error("Ad action button type not found.");
  error.statusCode = 404;
  return error;
};

export const createActionButton = async (data) => {
  try {
    const id = await model.createAdActionButton(data);
    return await model.getAdActionButtonById(id);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const duplicateError = new Error(
        "An ad action button with this code already exists.",
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
};

export const listActionButtons = async (includeInactive = true) => {
  return model.getAllAdActionButtons({ includeInactive });
};

export const getActionButton = async (id) => {
  const actionButton = await model.getAdActionButtonById(id);

  if (!actionButton) {
    throw notFound();
  }

  return actionButton;
};

export const editActionButton = async (id, data) => {
  const existing = await model.getAdActionButtonById(id);

  if (!existing) {
    throw notFound();
  }

  try {
    await model.updateAdActionButton(id, data);
    return await model.getAdActionButtonById(id);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const duplicateError = new Error(
        "An ad action button with this code already exists.",
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
};

export const changeActionButtonStatus = async (id, isActive) => {
  const existing = await model.getAdActionButtonById(id);

  if (!existing) {
    throw notFound();
  }

  await model.updateAdActionButtonStatus(id, isActive);

  return model.getAdActionButtonById(id);
};
