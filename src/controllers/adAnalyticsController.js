import adAnalyticsBatchSchema from "../validators/adAnalyticsValidator.js";
import {
  submitAdAnalyticsBatch,
} from "../services/adAnalyticsService.js";

export const submitAdAnalyticsBatchController = async (
  req,
  res,
  next,
) => {
  try {
    const { error, value } = adAnalyticsBatchSchema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      },
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Analytics batch validation failed.",
        errors: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
    }

    const result = await submitAdAnalyticsBatch(value);

    return res.status(result.rejected ? 409 : 200).json({
      success: !result.rejected,
      message:
        result.message ||
        (result.duplicate
          ? "Analytics batch was already processed."
          : "Ad analytics batch processed successfully."),
      data: result,
    });
  } catch (error) {
    next(error);
  }
};