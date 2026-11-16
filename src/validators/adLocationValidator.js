import Joi from "joi";

const coordinates = {
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
};

export const saveTargetSchema = Joi.object({
  place_id: Joi.string().trim().max(255).allow(null, "").optional(),

  location_name: Joi.string().trim().min(1).max(255).required(),

  ...coordinates,

  timezone: Joi.string().trim().min(1).max(64).required(),

  // TEMPORARILY DISABLED: accept old client fields but ignore them.
  // Re-enable radius validation here when radius targeting is implemented again.
  is_radius_enabled: Joi.any().strip(),
  radius_km: Joi.any().strip(),
});

export const reverseGeocodeSchema = Joi.object({
  ...coordinates,
});