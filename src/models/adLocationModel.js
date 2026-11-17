import db from "../configs/database/db.js";

export const saveTarget = async (adId, userId, data) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Allow location updates for draft, active and paused ads.
    // Ownership and soft-deletion checks are enforced.
    const [ads] = await connection.execute(
      `SELECT id
       FROM ads
       WHERE id = ?
         AND user_id = ?
         AND status IN ('draft', 'active', 'paused')
         AND moderation_status <> 'under_review'
         AND is_deleted = 0
       LIMIT 1
       FOR UPDATE`,
      [adId, userId],
    );

    if (ads.length === 0) {
      const error = new Error(
        "Ad not found, not editable, or you do not own this ad."
      );
      error.statusCode = 404;
      throw error;
    }

    // Insert a new location target or update the existing one.
    await connection.execute(
      `INSERT INTO ad_location_targets (
        ad_id,
        location_name,
        place_id,
        latitude,
        longitude,
        timezone,
        is_radius_enabled,
        radius_km
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        location_name = VALUES(location_name),
        place_id = VALUES(place_id),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        timezone = VALUES(timezone),
        is_radius_enabled = VALUES(is_radius_enabled),
        radius_km = VALUES(radius_km),
        updated_at = CURRENT_TIMESTAMP`,
      [
        adId,
        data.location_name,
        data.place_id ?? null,
        data.latitude,
        data.longitude,
        data.timezone,
        data.is_radius_enabled ? 1 : 0,
        data.is_radius_enabled ? data.radius_km : null,
      ],
    );

    // Step 2 is complete only after the location target has been saved.
    // Keep the highest completed step when the user navigates backwards.
    await connection.execute(
      `UPDATE ads
       SET last_completed_step = GREATEST(COALESCE(last_completed_step, 1), 2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND user_id = ?
         AND status = 'draft'
         AND is_deleted = 0`,
      [adId, userId],
    );

    await connection.commit();

    return await getTarget(adId, userId);

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
};

export const getTarget = async (adId, userId) => {
  const [rows] = await db.execute(
    `SELECT
        t.id,
        t.ad_id,
        t.location_name,
        t.place_id,
        t.latitude,
        t.longitude,
        t.timezone,
        t.is_radius_enabled,
        t.radius_km,
        t.created_at,
        t.updated_at
     FROM ad_location_targets t
     INNER JOIN ads a
       ON a.id = t.ad_id
     WHERE t.ad_id = ?
       AND a.user_id = ?
       AND a.is_deleted = 0
     LIMIT 1`,
    [adId, userId],
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    is_radius_enabled: Boolean(row.is_radius_enabled),
    radius_km:
      row.radius_km === null
        ? null
        : Number(row.radius_km),
  };
};