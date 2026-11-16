import {
  createAdminPricingRuleService,
  getAdminPricingRulesService,
  getAdminPricingRuleByIdService,
  updateAdminPricingRuleService,
  updateAdminPricingRuleStatusService,
} from "../services/adminPricingService.js";

import {
  createPricingRuleSchema,
  updatePricingRuleSchema,
  listPricingRulesSchema,
  pricingRuleIdSchema,
  updatePricingRuleStatusSchema,
} from "../validators/adminPricingValidator.js";

const validateRequest = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return {
      valid: false,
      message: error.details.map((detail) => detail.message).join(", "),
    };
  }

  return {
    valid: true,
    value,
  };
};

const handleControllerError = (res, error) => {
  const message = error.message || "Something went wrong";

  if (message.includes("already exists")) {
    return res.status(409).json({
      success: false,
      message,
    });
  }

  if (
    message.includes("Invalid or inactive") ||
    message.includes("An ad type is required")
  ) {
    
    return res.status(400).json({
      success: false,
      message,
    });
  }

  console.error("Admin Pricing Error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

export const createPricingRuleController = async (req, res) => {
  try {
    const validation = validateRequest(createPricingRuleSchema, req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const pricingRule = await createAdminPricingRuleService(validation.value);

    return res.status(201).json({
      success: true,
      message: "Pricing rule created successfully",
      data: pricingRule,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const listPricingRulesController = async (req, res) => {
  try {
    const validation = validateRequest(listPricingRulesSchema, req.body || {});

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const result = await getAdminPricingRulesService(validation.value);

    return res.status(200).json({
      success: true,
      message: "Pricing rules fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getPricingRuleController = async (req, res) => {
  try {
    const validation = validateRequest(pricingRuleIdSchema, req.params);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const pricingRule = await getAdminPricingRuleByIdService(
      validation.value.id,
    );

    if (!pricingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pricing rule fetched successfully",
      data: pricingRule,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updatePricingRuleController = async (req, res) => {
  try {
    const idValidation = validateRequest(pricingRuleIdSchema, req.params);

    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        message: idValidation.message,
      });
    }

    const bodyValidation = validateRequest(updatePricingRuleSchema, req.body);

    if (!bodyValidation.valid) {
      return res.status(400).json({
        success: false,
        message: bodyValidation.message,
      });
    }

    const pricingRule = await updateAdminPricingRuleService(
      idValidation.value.id,
      bodyValidation.value,
    );

    if (!pricingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pricing rule updated successfully",
      data: pricingRule,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updatePricingRuleStatusController = async (req, res) => {
  try {
    const idValidation = validateRequest(pricingRuleIdSchema, req.params);

    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        message: idValidation.message,
      });
    }

    const bodyValidation = validateRequest(
      updatePricingRuleStatusSchema,
      req.body,
    );

    if (!bodyValidation.valid) {
      return res.status(400).json({
        success: false,
        message: bodyValidation.message,
      });
    }

    const pricingRule = await updateAdminPricingRuleStatusService(
      idValidation.value.id,
      bodyValidation.value.is_active,
    );

    if (!pricingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        Number(bodyValidation.value.is_active) === 1
          ? "Pricing rule activated successfully"
          : "Pricing rule deactivated successfully",
      data: pricingRule,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
