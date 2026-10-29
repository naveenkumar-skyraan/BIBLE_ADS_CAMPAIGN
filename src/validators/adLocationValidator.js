import Joi from "joi";

const coordinates = {
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
};

export const saveTargetSchema = Joi.object({
  place_id: Joi.string().trim().max(255).allow(null, "").optional(),
  location_name: Joi.string().trim().min(1).max(255).required(),
  ...coordinates,
  is_radius_enabled: Joi.boolean().required(),
  radius_km: Joi.when("is_radius_enabled", {
    is: true,
    then: Joi.number().integer().min(5).max(100).required(),
    otherwise: Joi.valid(null).required(),
  }),
});

export const reverseGeocodeSchema = Joi.object({
  ...coordinates,
});
