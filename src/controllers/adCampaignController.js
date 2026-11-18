import adCampaignService from "../services/adCampaignService.js";
import { saveCampaignSchema } from "../validators/adCampaignValidator.js";

const parseAdId = (value) => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error("Invalid ad ID.");
    error.statusCode = 400;
    throw error;
  }

  return id;
};

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    const validationError = new Error(
      error.details.map((item) => item.message).join(", "),
    );

    validationError.statusCode = 400;
    throw validationError;
  }

  return value;
};

const adCampaignController = {
  async getCampaignDetails(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);

      const result = await adCampaignService.getCampaignDetails(
        adId,
        req.user.id,
      );

      return res.status(200).json({
        success: true,
        message: "Campaign details retrieved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async saveCampaign(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);

      const data = validate(saveCampaignSchema, req.body);

      const result = await adCampaignService.saveCampaign(
        adId,
        req.user.id,
        data,
      );

      return res.status(200).json({
        success: true,
        message: result.campaign?.scheduled_edit_applied
          ? "Scheduled campaign updated successfully."
          : "Campaign budget and duration saved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async republishCompletedAd(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);
      const result = await adCampaignService.republishCompletedAd(adId, req.user.id);

      return res.status(200).json({
        success: true,
        message: result.ad_status === "draft"
          ? "Completed advertisement republished as a scheduled campaign."
          : "Completed advertisement republished successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCampaignEstimation(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);

      const result = await adCampaignService.getCampaignEstimation(
        adId,
        req.user.id,
      );

      return res.status(200).json({
        success: true,
        message: "Campaign estimation retrieved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async publishCampaign(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);

      const result = await adCampaignService.publishCampaign(adId, req.user.id);

      return res.status(200).json({
        success: true,
        message:
          result.ad_status === "draft"
            ? "Campaign scheduled successfully."
            : result.ad_status === "paused"
              ? "Campaign changes saved successfully. The campaign remains paused."
              : "Campaign published or updated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default adCampaignController;
