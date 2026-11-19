const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const buildBusinessAddress = (business) => {
  const countryName = business.country_code
    ? new Intl.DisplayNames(["en"], { type: "region" }).of(business.country_code)
    : null;

  return [
    business.area,
    business.city,
    business.admin_area_2,
    business.admin_area_1,
    business.postal_code,
    countryName || business.country_code,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
};

export const resolveBusinessTimezone = async (business) => {
  const address = buildBusinessAddress(business);

  // A country alone is not enough to identify a timezone in multi-timezone
  // countries. Leave it unset until a usable business locality is available.
  const hasLocality = [
    business.area,
    business.city,
    business.admin_area_2,
    business.admin_area_1,
    business.postal_code,
  ].some((value) => String(value || "").trim());

  if (!hasLocality) return null;

  if (!GOOGLE_API_KEY) {
    throw createError("Google Maps API key is not configured; business timezone cannot be resolved.", 500);
  }

  const geocodeParams = new URLSearchParams({
    address,
    key: GOOGLE_API_KEY,
  });

  let geocodeResponse;
  try {
    geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${geocodeParams}`,
    );
  } catch {
    throw createError("Unable to connect to Google Geocoding to resolve business timezone.", 502);
  }

  const geocode = await geocodeResponse.json().catch(() => ({}));
  if (!geocodeResponse.ok || geocode.status !== "OK" || !geocode.results?.[0]?.geometry?.location) {
    throw createError(
      geocode.error_message || "Unable to resolve the business location. Please check its address details.",
      422,
    );
  }

  const { lat, lng } = geocode.results[0].geometry.location;
  const timezoneParams = new URLSearchParams({
    location: `${lat},${lng}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    key: GOOGLE_API_KEY,
  });

  let timezoneResponse;
  try {
    timezoneResponse = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?${timezoneParams}`,
    );
  } catch {
    throw createError("Unable to connect to Google Time Zone service.", 502);
  }

  const timezoneResult = await timezoneResponse.json().catch(() => ({}));
  if (
    !timezoneResponse.ok ||
    timezoneResult.status !== "OK" ||
    !timezoneResult.timeZoneId
  ) {
    throw createError(
      timezoneResult.errorMessage || "Unable to determine the business timezone.",
      422,
    );
  }

  return timezoneResult.timeZoneId;
};

export default resolveBusinessTimezone;
