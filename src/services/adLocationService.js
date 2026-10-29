const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureApiKey = () => {
  if (!GOOGLE_API_KEY) {
    throw createError("Google Maps API key is not configured.", 500);
  }
};

const googleRequest = async (url, options = {}) => {
  ensureApiKey();

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        ...(options.headers || {}),
      },
    });
  } catch {
    throw createError("Unable to connect to Google Maps services.", 502);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createError(
      result.error?.message || "Google Maps request failed.",
      502,
    );
  }

  return result;
};

const validateCoordinates = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    throw createError("Valid latitude and longitude are required.", 400);
  }

  return { latitude: lat, longitude: lng };
};

const adLocationService = {
  async autocomplete(input) {
    const query = String(input || "").trim();

    if (query.length < 2) {
      throw createError(
        "Search input must contain at least 2 characters.",
        400,
      );
    }

    const result = await googleRequest(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId," +
            "suggestions.placePrediction.text.text",
        },
        body: JSON.stringify({
          input: query,
        }),
      },
    );

    return (result.suggestions || [])
      .map((suggestion) => {
        const place = suggestion.placePrediction;

        if (!place?.placeId) {
          return null;
        }

        return {
          place_id: place.placeId,
          description: place.text?.text || "",
        };
      })
      .filter(Boolean);
  },

  async getPlaceDetails(placeId) {
    const id = String(placeId || "").trim();

    if (!id || id.length > 255) {
      throw createError("A valid Google Place ID is required.", 400);
    }

    const result = await googleRequest(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        },
      },
    );

    if (
      !result.location ||
      !Number.isFinite(result.location.latitude) ||
      !Number.isFinite(result.location.longitude)
    ) {
      throw createError("Coordinates are unavailable for this place.", 422);
    }

    return {
      place_id: result.id,
      location_name: result.formattedAddress || result.displayName?.text || "",
      latitude: result.location.latitude,
      longitude: result.location.longitude,
    };
  },

  async reverseGeocode(latitude, longitude) {
    const coordinates = validateCoordinates(latitude, longitude);

    const params = new URLSearchParams({
      latlng: `${coordinates.latitude},${coordinates.longitude}`,
      key: GOOGLE_API_KEY || "",
    });

    ensureApiKey();

    let response;

    try {
      response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      );
    } catch {
      throw createError("Unable to connect to Google Geocoding.", 502);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(result.status)) {
      throw createError(
        result.error_message || "Google reverse geocoding failed.",
        502,
      );
    }

    return {
      location_name:
        result.results?.[0]?.formatted_address ||
        `${coordinates.latitude}, ${coordinates.longitude}`,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  },
};

export default adLocationService;
