import googleLocationService from "../services/adLocationService.js";
import * as targetService from "../services/adLocationTargetService.js";
import {
  saveTargetSchema,
  reverseGeocodeSchema,
} from "../validators/adLocationValidator.js";
import { checkTargetEligibility } from "../services/adLocationTargetService.js";

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

const adLocationController = {
  async autocomplete(req, res, next) {
    try {
      const results = await googleLocationService.autocomplete(req.query.input);

      return res.status(200).json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  },

  async placeDetails(req, res, next) {
    try {
      const result = await googleLocationService.getPlaceDetails(
        req.params.placeId,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async reverseGeocode(req, res, next) {
    try {
      const data = validate(reverseGeocodeSchema, req.body);

      const result = await googleLocationService.reverseGeocode(
        data.latitude,
        data.longitude,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async saveTarget(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);
      const data = validate(saveTargetSchema, req.body);

      const result = await targetService.saveTarget(adId, req.user.id, data);

      return res.status(200).json({
        success: true,
        message: "Ad location target saved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getTarget(req, res, next) {
    try {
      const adId = parseAdId(req.params.id);

      const result = await targetService.getTarget(adId, req.user.id);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export const checkLocationTarget = async (req, res, next) => {
  try {
    const adId = parseAdId(req.params.id);
    const { latitude, longitude } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === null ||
      longitude === null ||
      latitude === "" ||
      longitude === "" ||
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required.",
      });
    }

    const result = await checkTargetEligibility(
      adId,
      req.user.id,
      Number(latitude),
      Number(longitude),
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default adLocationController;
