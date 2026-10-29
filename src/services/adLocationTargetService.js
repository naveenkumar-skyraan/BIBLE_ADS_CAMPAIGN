import * as model from "../models/adLocationModel.js";
import googleLocationService from "./adLocationService.js";
import { checkRadiusEligibility } from "../utils/locationDistance.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const saveTarget = async (adId, userId, data) => {
  let location;

  if (data.place_id) {
    // Resolve the Place ID on the backend rather than
    // trusting client-submitted coordinates.
    location = await googleLocationService.getPlaceDetails(data.place_id);
  } else {
    // Used for the mobile app's current GPS location.
    location = await googleLocationService.reverseGeocode(
      data.latitude,
      data.longitude,
    );
  }

  const result = await model.saveTarget(adId, userId, {
    ...data,
    ...location,
    is_radius_enabled: data.is_radius_enabled,
    radius_km: data.is_radius_enabled ? data.radius_km : null,
  });

  return result;
};

export const getTarget = async (adId, userId) => {
  const target = await model.getTarget(adId, userId);

  if (!target) {
    throw createError("Location target not found for this ad.", 404);
  }

  return target;
};

export const checkTargetEligibility = async (
  adId,
  userId,
  viewerLatitude,
  viewerLongitude,
) => {
  const target = await getTarget(adId, userId);

  if (!target.is_radius_enabled) {
    return {
      ad_id: Number(adId),
      radius_enabled: false,
      eligible: null,
      message: "Radius targeting is disabled.",
    };
  }

  const result = checkRadiusEligibility({
    targetLatitude: target.latitude,
    targetLongitude: target.longitude,
    viewerLatitude,
    viewerLongitude,
    radiusKm: target.radius_km,
  });

  return {
    ad_id: Number(adId),
    target_location: target.location_name,
    viewer_location: {
      latitude: Number(viewerLatitude),
      longitude: Number(viewerLongitude),
    },
    ...result,
  };
};
