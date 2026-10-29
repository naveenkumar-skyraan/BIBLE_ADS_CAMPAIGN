const EARTH_RADIUS_KM = 6371;

export const calculateDistanceKm = (
  latitude1,
  longitude1,
  latitude2,
  longitude2,
) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const lat1 = Number(latitude1);
  const lon1 = Number(longitude1);
  const lat2 = Number(latitude2);
  const lon2 = Number(longitude2);

  const deltaLatitude = toRadians(lat2 - lat1);
  const deltaLongitude = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLongitude / 2) ** 2;

  const boundedA = Math.min(1, Math.max(0, a));

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA))
  );
};

export const checkRadiusEligibility = ({
  targetLatitude,
  targetLongitude,
  viewerLatitude,
  viewerLongitude,
  radiusKm,
}) => {
  const coordinates = [
    targetLatitude,
    targetLongitude,
    viewerLatitude,
    viewerLongitude,
  ];

  if (
    coordinates.some(
      (value) =>
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value)),
    )
  ) {
    throw new Error("All coordinates must be valid numbers.");
  }

  const [targetLat, targetLon, viewerLat, viewerLon] = coordinates.map(Number);

  if (
    targetLat < -90 ||
    targetLat > 90 ||
    viewerLat < -90 ||
    viewerLat > 90 ||
    targetLon < -180 ||
    targetLon > 180 ||
    viewerLon < -180 ||
    viewerLon > 180
  ) {
    throw new Error("Coordinates are outside their valid ranges.");
  }

  const radius = Number(radiusKm);

  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Radius must be a positive number.");
  }

  const distanceKm = calculateDistanceKm(
    targetLat,
    targetLon,
    viewerLat,
    viewerLon,
  );

  return {
    distance_km: Number(distanceKm.toFixed(3)),
    radius_km: radius,
    eligible: distanceKm <= radius,
  };
};
