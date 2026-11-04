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
        message: "Campaign budget and duration saved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async publishCampaign(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);

      const result = await adCampaignService.publishCampaign(
        adId,
        req.user.id,
      );

      return res.status(200).json({
        success: true,
        message:
          result.campaign.status === "pending"
            ? "Campaign published and scheduled successfully."
            : "Campaign published successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default adCampaignController;