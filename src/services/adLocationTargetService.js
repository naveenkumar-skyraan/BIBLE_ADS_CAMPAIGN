import * as model from "../models/adLocationModel.js";
import googleLocationService from "./adLocationService.js";
import { checkRadiusEligibility } from "../utils/locationDistance.js";

// TEMPORARILY DISABLED: switch to true when radius targeting is implemented again.
const RADIUS_TARGETING_ENABLED = false;

const validateTimezone = (timezone) => {
  try {
    if (typeof timezone !== "string" || !timezone.trim()) {
      throw new Error("Timezone is required.");
    }

    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    });

    return timezone;
  } catch {
    throw createError("Invalid IANA timezone identifier.", 400);
  }
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const saveTarget = async (adId, userId, data) => {
  const timezone = validateTimezone(data.timezone);

  let location;

  if (data.place_id) {
    location = await googleLocationService.getPlaceDetails(
      data.place_id,
    );
  } else {
    location = await googleLocationService.reverseGeocode(
      data.latitude,
      data.longitude,
    );
  }

  const result = await model.saveTarget(adId, userId, {
    ...data,
    ...location,
    timezone,
    // Radius controls are currently hidden; retain the DB columns for later use.
    is_radius_enabled: false,
    radius_km: null,
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

  if (!RADIUS_TARGETING_ENABLED || !target.is_radius_enabled) {
    return {
      ad_id: Number(adId),
      radius_enabled: false,
      eligible: null,
      message: "Radius targeting is temporarily disabled.",
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
