import db from "../configs/database/db.js";
import { DateTime } from "luxon";
import {
  decimalToMicros,
  microsToDecimal,
} from "../utils/adSpendCalculator.js";
import { getWalletCommitmentSummary } from "../utils/campaignWalletFunding.js";

const createError = (message, statusCode = 400, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

export const createAd = async (userId, data, fileData) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [adResult] = await connection.execute(
      `INSERT INTO ads (
      user_id,
      business_id,
      objective_id,
      ad_type_id,
      ad_subtype_id,
      title,
      description,
      action_button_type_id,
      destination_link,
      platform,
      status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        userId,
        data.business_id,
        data.objective_id,
        data.ad_type_id,
        data.ad_subtype_id ?? null,
        data.title,
        data.description,
        data.action_button_type_id ?? null,
        data.destination_link || null,
        data.platform,
      ],
    );

    const adId = adResult.insertId;

    await connection.execute(
      `INSERT INTO ad_media (
                ad_id,
                media_type,
                file_url,
                file_name,
                mime_type,
                file_size,
                sort_order,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        adId,
        fileData.mediaType,
        fileData.fileUrl,
        fileData.fileName,
        fileData.mimeType,
        fileData.fileSize,
      ],
    );

    await connection.commit();

    return adId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getAdById = async (adId, userId) => {
  const [rows] = await db.execute(
    `SELECT
            a.id,
            a.campaign_id,
            c.campaign_code,
            a.user_id,
            a.business_id,
            a.objective_id,
            a.ad_type_id,
            a.ad_subtype_id,
            a.title,
            a.description,
            a.action_button_type_id,
            a.destination_link,
            a.platform,
            a.status,
            a.moderation_status,
            a.last_completed_step,
            LEAST(a.last_completed_step + 1, 3) AS resume_step,
            CASE
              WHEN a.status = 'draft'
                AND c.status = 'draft'
                AND c.start_timestamp > UNIX_TIMESTAMP()
                AND c.end_timestamp >= UNIX_TIMESTAMP()
                AND EXISTS (
                  SELECT 1
                  FROM ad_campaign_pricing cp
                  WHERE cp.campaign_id = c.id
                )
              THEN 1 ELSE 0
            END AS is_scheduled,
            a.created_at,
            a.updated_at,
            m.id AS media_id,
            m.media_type,
            m.file_url,
            m.file_name,
            m.mime_type,
            m.file_size
        FROM ads a
        LEFT JOIN ad_campaigns c
            ON c.id = a.campaign_id
            AND c.user_id = a.user_id
            AND c.is_deleted = 0
        LEFT JOIN ad_media m
            ON m.ad_id = a.id
            AND m.is_active = 1
WHERE a.id = ?
    AND a.user_id = ?
    AND a.is_deleted = 0
    AND (
      a.campaign_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM ad_campaigns c
        WHERE c.id = a.campaign_id
          AND c.user_id = a.user_id
          AND c.is_deleted = 0
      )
    )
LIMIT 1`,
    [adId, userId],
  );

  if (!rows[0]) return null;
  return {
    ...rows[0],
    is_scheduled: Boolean(rows[0].is_scheduled),
  };
};

export const updateAd = async (adId, userId, data, fileData = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
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

    if (existingRows.length === 0) {
      await connection.rollback();
      return { notFound: true };
    }

    const fields = [];
    const values = [];

    const editableFields = [
      "business_id",
      "objective_id",
      "title",
      "description",
      "ad_type_id",
      "ad_subtype_id",
      "action_button_type_id",
      "destination_link",
      "platform",
    ];

    for (const field of editableFields) {
      if (Object.hasOwn(data, field)) {
        fields.push(`${field} = ?`);
        values.push(data[field] === "" ? null : data[field]);
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = CURRENT_TIMESTAMP");

      await connection.execute(
        `UPDATE ads
                 SET ${fields.join(", ")}
                 WHERE id = ? AND user_id = ?`,
        [...values, adId, userId],
      );
    }

    if (fileData) {
      await connection.execute(
        `UPDATE ad_media
                 SET is_active = 0
                 WHERE ad_id = ? AND is_active = 1`,
        [adId],
      );

      await connection.execute(
        `INSERT INTO ad_media (
                    ad_id,
                    media_type,
                    file_url,
                    file_name,
                    mime_type,
                    file_size,
                    sort_order,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          adId,
          fileData.mediaType,
          fileData.fileUrl,
          fileData.fileName,
          fileData.mimeType,
          fileData.fileSize,
        ],
      );
    }

    await connection.commit();

    return { notFound: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getAdDetailsForView = async (
  adId,
  userId,
  period = "this_month",
) => {
  const allowedPeriods = [
    "this_month",
    "this_year",
    "this_week",
    "last_month",
    "last_year",
  ];

  if (!allowedPeriods.includes(period)) {
    throw createError(
      `Invalid performance period. Allowed values: ${allowedPeriods.join(", ")}.`,
      400,
    );
  }

  const [timezoneRows] = await db.execute(
    `SELECT c.timezone
     FROM ads a
     LEFT JOIN ad_campaigns c
       ON c.id = a.campaign_id AND c.user_id = a.user_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_deleted = 0
     LIMIT 1`,
    [adId, userId],
  );

  if (!timezoneRows.length) return null;

  const zone = timezoneRows[0].timezone || "UTC";
  const now = DateTime.now().setZone(zone);

  let startDate;
  let endDate = now.toISODate();

  switch (period) {
    case "this_month":
      startDate = now.startOf("month").toISODate();
      break;

    case "this_year":
      startDate = now.startOf("year").toISODate();
      break;

    case "this_week":
      startDate = now.startOf("week").toISODate();
      break;

    case "last_month":
      startDate = now.minus({ months: 1 }).startOf("month").toISODate();
      endDate = now.startOf("month").minus({ days: 1 }).toISODate();
      break;

    case "last_year":
      startDate = now.minus({ years: 1 }).startOf("year").toISODate();
      endDate = now.startOf("year").minus({ days: 1 }).toISODate();
      break;
  }

  const performanceWhere = "ds.campaign_local_date BETWEEN ? AND ?";
  const performanceValues = [startDate, endDate];

  const [rows] = await db.execute(
    `
      SELECT
        a.id AS ad_id,
        a.campaign_id,
        c.campaign_code,
        a.user_id,
        a.business_id,
        bd.business_name,
        a.objective_id,
        ao.name AS objective_name,
        a.ad_type_id,
        at.name AS ad_type_name,
        a.ad_subtype_id,
        ast.name AS ad_subtype_name,
        a.title,
        a.description,
        a.action_button_type_id,
        abt.name AS action_button_name,
        a.destination_link,
        a.platform,
        a.status AS ad_status,
        a.moderation_status,
        a.created_at AS ad_created_at,
        a.updated_at AS ad_updated_at,
        m.id AS media_id,
        m.media_type,
        m.file_url,
        m.file_name,
        m.mime_type,
        m.file_size,
        c.status AS campaign_status,
        c.currency_code,
        c.total_budget,
        c.daily_budget,
        c.duration_type,
        c.duration_days,
        DATE_FORMAT(c.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(c.end_date, '%Y-%m-%d') AS end_date,
        c.start_timestamp,
        c.end_timestamp,
        c.timezone,
        c.created_at AS campaign_created_at,
        lt.location_name,
        lt.place_id,
        lt.latitude,
        lt.longitude,
        lt.timezone AS location_timezone,
        lt.is_radius_enabled,
        lt.radius_km,
        COALESCE(perf.impressions, 0) AS impressions,
        COALESCE(perf.clicks, 0) AS clicks,
        COALESCE(perf.total_spend, 0) AS spend
      FROM ads a
      INNER JOIN business_details bd
        ON bd.id = a.business_id AND bd.user_id = a.user_id AND bd.is_deleted = 0
      LEFT JOIN ad_objectives ao ON ao.id = a.objective_id
      LEFT JOIN ad_types at ON at.id = a.ad_type_id
      LEFT JOIN ad_subtypes ast ON ast.id = a.ad_subtype_id
      LEFT JOIN ad_action_button_types abt ON abt.id = a.action_button_type_id
      LEFT JOIN ad_media m ON m.ad_id = a.id AND m.is_active = 1
      LEFT JOIN ad_campaigns c
        ON c.id = a.campaign_id AND c.user_id = a.user_id AND c.is_deleted = 0
      LEFT JOIN ad_location_targets lt ON lt.ad_id = a.id
      LEFT JOIN (
        SELECT campaign_id,
               SUM(impressions) AS impressions,
               SUM(clicks) AS clicks,
               SUM(CASE
                 WHEN ds.currency_code = (
                   SELECT c2.currency_code FROM ad_campaigns c2
                   WHERE c2.id = ds.campaign_id LIMIT 1
                 )
                 THEN total_charge ELSE 0
               END) AS total_spend
        FROM ad_campaign_daily_spend ds
        WHERE ${performanceWhere}
        GROUP BY campaign_id
      ) perf ON perf.campaign_id = c.id
      WHERE a.id = ? AND a.user_id = ? AND a.is_deleted = 0
      LIMIT 1
    `,
    [...performanceValues, adId, userId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  const spendByCurrency = row.campaign_id
    ? (
        await db.execute(
          `SELECT currency_code, SUM(total_charge) AS spend
         FROM ad_campaign_daily_spend ds
         WHERE campaign_id = ? AND ${performanceWhere}
         GROUP BY currency_code`,
          [...performanceValues, row.campaign_id],
        )
      )[0].map((item) => ({
        currency_code: item.currency_code,
        spend: String(item.spend),
      }))
    : [];
  return {
    ad: {
      id: row.ad_id,
      campaign_id: row.campaign_id,
      campaign_code: row.campaign_code,
      business_id: row.business_id,
      business_name: row.business_name,
      objective_id: row.objective_id,
      objective_name: row.objective_name,
      ad_type_id: row.ad_type_id,
      ad_type_name: row.ad_type_name,
      ad_subtype_id: row.ad_subtype_id,
      ad_subtype_name: row.ad_subtype_name,
      title: row.title,
      description: row.description,
      action_button_type_id: row.action_button_type_id,
      action_button_name: row.action_button_name,
      destination_link: row.destination_link,
      platform: row.platform,
      status: row.ad_status,
      moderation_status: row.moderation_status,
      created_at: row.ad_created_at,
      updated_at: row.ad_updated_at,
      media: row.media_id
        ? {
            id: row.media_id,
            type: row.media_type,
            url: row.file_url,
            file_name: row.file_name,
            mime_type: row.mime_type,
            file_size: row.file_size,
          }
        : null,
    },
    campaign: row.campaign_id
      ? {
          id: row.campaign_id,
          campaign_code: row.campaign_code,
          status: row.campaign_status,
          currency_code: row.currency_code,
          total_budget: row.total_budget,
          daily_budget: row.daily_budget,
          duration_type: row.duration_type,
          duration_days: row.duration_days,
          start_date: row.start_date,
          end_date: row.end_date,
          start_timestamp: row.start_timestamp,
          end_timestamp: row.end_timestamp,
          timezone: row.timezone,
          created_at: row.campaign_created_at,
        }
      : null,
    location: row.location_name
      ? {
          location_name: row.location_name,
          place_id: row.place_id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          timezone: row.location_timezone,
          is_radius_enabled: Boolean(row.is_radius_enabled),
          radius_km: row.radius_km === null ? null : Number(row.radius_km),
        }
      : null,
    performance: {
      period,
      impressions: Number(row.impressions),
      clicks: Number(row.clicks),
      spend: String(row.spend),
      currency_code: row.currency_code ?? null,
      spend_by_currency: spendByCurrency,
    },
  };
};

export const getAdEstimationInputs = async (adId, userId) => {
  const [rows] = await db.execute(
    `
      SELECT
        a.id AS ad_id,
        a.objective_id,
        a.ad_type_id,
        a.ad_subtype_id,
        a.platform,
        a.business_id,
        a.status,
        bd.country_code,
        bd.admin_area_1,
        bd.city,
        m.media_type
      FROM ads a
      INNER JOIN business_details bd
        ON bd.id = a.business_id
        AND bd.user_id = a.user_id
        AND bd.is_deleted = 0
      INNER JOIN ad_media m
        ON m.ad_id = a.id
        AND m.is_active = 1
      WHERE a.id = ?
      AND a.is_deleted = 0
        AND a.user_id = ?
      LIMIT 1
    `,
    [adId, userId],
  );

  return rows[0] ?? null;
};

export const getAdTypeInfoForUpdate = async (adId, userId) => {
  const [rows] = await db.execute(
    `SELECT
        id,
        ad_type_id,
        ad_subtype_id
     FROM ads
     WHERE id = ?
       AND user_id = ?
       AND is_deleted = 0
       AND status IN ('draft', 'active', 'paused')
       AND moderation_status <> 'under_review'
     LIMIT 1`,
    [adId, userId],
  );

  return rows[0] ?? null;
};

export const getMyAds = async (userId, { status, search, limit, offset }) => {
  const conditions = [
    "a.user_id = ?",
    "a.is_deleted = 0",
    `(
    a.campaign_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM ad_campaigns deleted_check
      WHERE deleted_check.id = a.campaign_id
        AND deleted_check.user_id = a.user_id
        AND deleted_check.is_deleted = 0
    )
  )`,
  ];
  const values = [userId];

  if (status === "under_verify") {
    conditions.push(
      "a.status = 'active' AND a.moderation_status = 'under_review'",
    );
  } else if (status === "active") {
    conditions.push(
      "a.status = 'active' AND a.moderation_status <> 'under_review'",
    );
  } else if (status) {
    conditions.push("a.status = ?");
    values.push(status);
  }

  if (search) {
    conditions.push("(a.title LIKE ? OR a.description LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.join(" AND ");

  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM ads a
      WHERE ${whereClause}
    `,
    values,
  );

  const [rows] = await db.execute(
    `
      SELECT
        a.id,
        a.campaign_id,
        c.campaign_code,
        a.user_id,
        a.business_id,
        a.objective_id,
        a.ad_type_id,
        a.ad_subtype_id,
        a.title,
        a.description,
        a.action_button_type_id,
        a.destination_link,
        a.platform,
        a.status AS ad_status,
        a.last_completed_step,
        LEAST(a.last_completed_step + 1, 3) AS resume_step,
        CASE
          WHEN a.status = 'draft'
            AND c.status = 'draft'
            AND c.start_timestamp > UNIX_TIMESTAMP()
            AND c.end_timestamp >= UNIX_TIMESTAMP()
            AND EXISTS (
              SELECT 1
              FROM ad_campaign_pricing cp
              WHERE cp.campaign_id = c.id
            )
          THEN 1 ELSE 0
        END AS is_scheduled,
        a.moderation_status,
        a.created_at,
        a.updated_at,

        c.status AS campaign_status,
        c.budget_type,
        c.total_budget,
        c.daily_budget,
        c.duration_type,
        c.duration_days,
        c.start_date,
        c.end_date,
        c.timezone,

        m.id AS media_id,
        m.media_type,
        m.file_url,
        m.file_name,
        m.mime_type,
        m.file_size

      FROM ads a

      LEFT JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id

      LEFT JOIN ad_media m
        ON m.ad_id = a.id
        AND m.is_active = 1

      WHERE ${whereClause}

      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset],
  );

  return {
    total: Number(countRows[0].total),
    ads: rows.map((row) => ({
      ...row,
      is_scheduled: Boolean(row.is_scheduled),
    })),
  };
};

export const pauseAd = async (adId, userId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          a.id,
          a.campaign_id,
          a.status AS ad_status,
          a.moderation_status,
          c.status AS campaign_status
        FROM ads a
        INNER JOIN ad_campaigns c ON c.id = a.campaign_id
        WHERE a.id = ?
          AND a.user_id = ?
          AND a.is_deleted = 0
          AND c.is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (!rows.length) {
      throw createError("Ad or campaign not found.", 404);
    }

    const ad = rows[0];

    if (ad.ad_status !== "active" || ad.campaign_status !== "active") {
      throw createError("Only active ads can be paused.", 409);
    }

    if (ad.moderation_status !== "none") {
      throw createError(
        "This ad cannot be paused while it is under moderation.",
        409,
      );
    }

    const pausedAt = Math.floor(Date.now() / 1000);

    const [campaignUpdate] = await connection.execute(
      `
        UPDATE ad_campaigns
        SET
          status = 'paused',
          pause_reason = 'manual',
          resume_at = NULL,
          paused_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'active'
          AND is_deleted = 0
      `,
      [pausedAt, ad.campaign_id, userId],
    );

    if (campaignUpdate.affectedRows !== 1) {
      throw createError("Campaign could not be paused.", 409);
    }

    const [adUpdate] = await connection.execute(
      `
        UPDATE ads
        SET status = 'paused', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'active'
          AND is_deleted = 0
      `,
      [adId, userId],
    );

    if (adUpdate.affectedRows !== 1) {
      throw createError("Ad could not be paused.", 409);
    }

    await connection.execute(
      `
        UPDATE ad_campaign_pause_history
        SET resumed_at = ?
        WHERE campaign_id = ?
          AND ad_id = ?
          AND resumed_at IS NULL
          AND paused_at <= ?
      `,
      [pausedAt, ad.campaign_id, adId, pausedAt],
    );

    await connection.execute(
      `
        INSERT INTO ad_campaign_pause_history (
          campaign_id,
          ad_id,
          pause_reason,
          paused_at
        )
        VALUES (?, ?, 'manual', ?)
      `,
      [ad.campaign_id, adId, pausedAt],
    );

    await connection.commit();
    return { status: "paused", pause_reason: "manual", paused_at: pausedAt };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const resumeAd = async (adId, userId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [walletRows] = await connection.execute(
      `SELECT id FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    if (!walletRows.length) throw createError("Wallet not found.", 404);

    const [rows] = await connection.execute(
      `
        SELECT
          a.id,
          a.campaign_id,
          a.status AS ad_status,
          a.moderation_status,
          c.status AS campaign_status,
          c.pause_reason,
          c.paused_at,
          c.start_timestamp,
          c.end_timestamp,
          c.currency_code
        FROM ads a
        INNER JOIN ad_campaigns c ON c.id = a.campaign_id
        WHERE a.id = ?
          AND a.user_id = ?
          AND a.is_deleted = 0
          AND c.is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (!rows.length) throw createError("Ad or campaign not found.", 404);
    const ad = rows[0];
    const now = Math.floor(Date.now() / 1000);

    if (ad.ad_status !== "paused" || ad.campaign_status !== "paused") {
      throw createError("Only paused ads can be resumed.", 409);
    }
    if (ad.moderation_status !== "none") {
      throw createError(
        "This ad cannot be resumed because it is under moderation.",
        409,
      );
    }
    if (ad.pause_reason === "daily_budget") {
      throw createError(
        "This campaign will resume automatically at the start of its next campaign-local day.",
        409,
      );
    }
    if (!["manual", "wallet_insufficient", null].includes(ad.pause_reason)) {
      throw createError("This campaign cannot be manually resumed.", 409);
    }
    if (
      !ad.start_timestamp ||
      !ad.end_timestamp ||
      Number(ad.start_timestamp) > now ||
      Number(ad.end_timestamp) < now
    ) {
      throw createError("Campaign is not within its scheduled period.", 409);
    }
    if (!ad.currency_code)
      throw createError("Campaign currency is missing.", 409);

    const walletId = walletRows[0].id;
    await connection.execute(
      `INSERT IGNORE INTO wallet_balances (wallet_id, currency_code, balance) VALUES (?, ?, 0.000000)`,
      [walletId, ad.currency_code],
    );
    const [balanceRows] = await connection.execute(
      `SELECT balance FROM wallet_balances WHERE wallet_id = ? AND currency_code = ? FOR UPDATE`,
      [walletId, ad.currency_code],
    );
    if (!balanceRows.length)
      throw createError("Wallet currency balance not found.", 404);

    const funding = await getWalletCommitmentSummary(
      connection,
      userId,
      now,
      ad.currency_code,
    );
    const availableMicros = decimalToMicros(balanceRows[0].balance);

    if (availableMicros < funding.committedPayableMicros) {
      const additionalMicros = funding.committedPayableMicros - availableMicros;
      throw createError(
        "Insufficient wallet balance to resume your published campaigns. Please add funds.",
        400,
        {
          available_balance: Number(microsToDecimal(availableMicros)),
          required_balance: Number(funding.committedPayable),
          additional_amount_required: Number(microsToDecimal(additionalMicros)),
          currency: ad.currency_code,
        },
      );
    }

    const [campaignUpdate] = await connection.execute(
      `
        UPDATE ad_campaigns
        SET status = 'active', pause_reason = NULL, resume_at = NULL,
            paused_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ? AND status = 'paused' AND is_deleted = 0
      `,
      [ad.campaign_id, userId],
    );
    if (campaignUpdate.affectedRows !== 1) {
      throw createError("Campaign could not be resumed.", 409);
    }

    const [adUpdate] = await connection.execute(
      `
        UPDATE ads
        SET status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ? AND status = 'paused'
          AND moderation_status = 'none' AND is_deleted = 0
      `,
      [adId, userId],
    );
    if (adUpdate.affectedRows !== 1)
      throw createError("Ad could not be resumed.", 409);

    await connection.execute(
      `
        UPDATE ad_campaign_pause_history
        SET resumed_at = ?
        WHERE campaign_id = ? AND ad_id = ? AND resumed_at IS NULL
      `,
      [now, ad.campaign_id, adId],
    );

    await connection.commit();
    return { status: "active", resumed_at: now, currency: ad.currency_code };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const submitAdForReview = async (adId, userId, data) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          id,
          status,
          moderation_status
        FROM ads
        WHERE id = ?
        AND user_id = ?
        AND is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return { notFound: true };
    }

    const ad = rows[0];

    if (ad.status !== "active" || ad.moderation_status !== "blocked") {
      await connection.rollback();
      return { invalidState: true };
    }

    const [updateResult] = await connection.execute(
      `
        UPDATE ads
        SET
          moderation_status = 'under_review',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'active'
          AND moderation_status = 'blocked'
      `,
      [adId, userId],
    );

    if (updateResult.affectedRows !== 1) {
      await connection.rollback();
      return { invalidState: true };
    }

    const [historyResult] = await connection.execute(
      `
        INSERT INTO ad_moderation_history (
          ad_id,
          user_id,
          event_type,
          update_reason,
          contact_email,
          document_path,
          document_name,
          document_mime_type,
          document_size
        )
        VALUES (?, ?, 'resubmitted', ?, ?, ?, ?, ?, ?)
      `,
      [
        adId,
        userId,
        data.updateReason,
        data.email,
        data.documentPath,
        data.documentName,
        data.documentMimeType,
        data.documentSize,
      ],
    );

    await connection.commit();

    return {
      notFound: false,
      invalidState: false,
      historyId: historyResult.insertId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getAdModerationHistory = async (adId, userId) => {
  const [ads] = await db.execute(
    `
      SELECT
        id,
        status,
        moderation_status
      FROM ads
      WHERE id = ?
      AND is_deleted = 0
      AND user_id = ?
      LIMIT 1
    `,
    [adId, userId],
  );

  if (ads.length === 0) {
    return null;
  }

  const [history] = await db.execute(
    `
      SELECT
        id,
        event_type,
        reason,
        update_reason,
        contact_email,
        document_path,
        document_name,
        document_mime_type,
        document_size,
        created_at
      FROM ad_moderation_history
      WHERE ad_id = ?
        AND user_id = ?
      ORDER BY id DESC
    `,
    [adId, userId],
  );

  return {
    ad_id: ads[0].id,
    ad_status: ads[0].status,
    moderation_status: ads[0].moderation_status,
    history,
  };
};

export const getActiveCancellationReasons = async () => {
  const [rows] = await db.execute(
    `SELECT
      id,
      reason_text,
      requires_other
    FROM ad_cancellation_reasons
    WHERE is_active = 1
    ORDER BY sort_order ASC, id ASC`,
  );

  return rows;
};

export const getPausedAdDeletePreview = async (adId, userId) => {
  const [rows] = await db.execute(
    `
      SELECT
        a.id AS ad_id,
        a.title AS campaign_name,
        a.status AS ad_status,
        a.moderation_status,
        c.id AS campaign_id,
        c.campaign_code,
        c.status AS campaign_status,
        c.currency_code,
        c.total_budget,
        COALESCE(SUM(ds.total_charge), 0) AS amount_spent
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
        AND c.is_deleted = 0
      LEFT JOIN ad_campaign_daily_spend ds
        ON ds.campaign_id = c.id
        AND ds.currency_code = c.currency_code
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.is_deleted = 0
      GROUP BY
        a.id, a.title, a.status, a.moderation_status,
        c.id, c.campaign_code, c.status, c.currency_code, c.total_budget
      LIMIT 1
    `,
    [adId, userId],
  );

  if (!rows.length) return { notFound: true };
  const row = rows[0];
  if (row.ad_status !== "paused") return { invalidState: true };

  const budgetMicros = decimalToMicros(row.total_budget);
  const spentMicros = decimalToMicros(row.amount_spent);
  const remainingMicros =
    budgetMicros > spentMicros ? budgetMicros - spentMicros : 0n;

  return {
    ad_id: String(row.ad_id),
    campaign_id: String(row.campaign_id),
    campaign_code: row.campaign_code,
    campaign_name: row.campaign_name,
    ad_status: row.ad_status,
    moderation_status: row.moderation_status,
    campaign_status: row.campaign_status,
    currency_code: row.currency_code,
    total_budget: microsToDecimal(budgetMicros),
    amount_spent: microsToDecimal(spentMicros),
    remaining_amount: microsToDecimal(remainingMicros),
  };
};


export const deleteAd = async (adId, userId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          a.id AS ad_id,
          a.campaign_id,
          a.status AS ad_status,
          a.moderation_status,
          c.status AS campaign_status,
          c.campaign_code,
          c.is_deleted AS campaign_is_deleted
        FROM ads a
        LEFT JOIN ad_campaigns c
          ON c.id = a.campaign_id
          AND c.user_id = a.user_id
        WHERE a.id = ?
          AND a.user_id = ?
          AND a.is_deleted = 0
          AND (a.campaign_id IS NULL OR c.is_deleted = 0)
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (!rows.length) {
      await connection.rollback();
      return { notFound: true };
    }

    const ad = rows[0];
    let cancellationId = null;

    // Active advertisements must have a previously submitted
    // cancellation reason.
    if (ad.ad_status === "active") {
      if (!ad.campaign_id || ad.campaign_status !== "active") {
        await connection.rollback();
        return { invalidState: true };
      }

      const [pendingRows] = await connection.execute(
        `
          SELECT id
          FROM ad_campaign_cancellations
          WHERE campaign_id = ?
            AND ad_id = ?
            AND user_id = ?
            AND cancelled_at IS NULL
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [ad.campaign_id, adId, userId],
      );

      if (!pendingRows.length) {
        await connection.rollback();
        return { missingCancellation: true };
      }

      cancellationId = pendingRows[0].id;
    }

    const deletedAt = Math.floor(Date.now() / 1000);

    // Delete campaign and stop billing.
    if (ad.campaign_id) {
      const [campaignResult] = await connection.execute(
        `
          UPDATE ad_campaigns
          SET
            is_deleted = 1,
            deleted_at = ?,
            billing_stopped_at = COALESCE(billing_stopped_at, ?),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND user_id = ?
            AND is_deleted = 0
        `,
        [deletedAt, deletedAt, ad.campaign_id, userId],
      );

      if (campaignResult.affectedRows !== 1) {
        throw new Error("Campaign could not be deleted.");
      }
    }

    // Soft-delete the associated ad.
    const [adResult] = await connection.execute(
      `
        UPDATE ads
        SET
          is_deleted = 1,
          deleted_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND is_deleted = 0
      `,
      [deletedAt, adId, userId],
    );

    if (adResult.affectedRows !== 1) {
      throw new Error("Ad could not be deleted.");
    }

    // Mark the existing cancellation record as confirmed.
    if (cancellationId !== null) {
      const [cancellationResult] = await connection.execute(
        `
          UPDATE ad_campaign_cancellations
          SET cancelled_at = ?
          WHERE id = ?
            AND campaign_id = ?
            AND ad_id = ?
            AND user_id = ?
            AND cancelled_at IS NULL
        `,
        [
          deletedAt,
          cancellationId,
          ad.campaign_id,
          adId,
          userId,
        ],
      );

      if (cancellationResult.affectedRows !== 1) {
        throw new Error("Cancellation confirmation could not be recorded.");
      }
    }

    await connection.commit();

    return {
      notFound: false,
      ad_id: String(adId),
      campaign_id: ad.campaign_id == null
        ? null
        : String(ad.campaign_id),
      campaign_code: ad.campaign_code || null,
      cancellation_id: cancellationId === null
        ? null
        : String(cancellationId),
      deleted_at: deletedAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};



export const cancelActiveAd = async (adId, userId, data) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          a.id AS ad_id,
          a.campaign_id,
          a.status AS ad_status,
          c.user_id,
          c.campaign_code,
          c.status AS campaign_status
        FROM ads a
        INNER JOIN ad_campaigns c
          ON c.id = a.campaign_id
          AND c.user_id = a.user_id
        WHERE a.id = ?
          AND a.user_id = ?
          AND a.is_deleted = 0
          AND c.is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (!rows.length) {
      await connection.rollback();
      return { notFound: true };
    }

    const ad = rows[0];

    if (
      ad.ad_status !== "active" ||
      ad.campaign_status !== "active"
    ) {
      await connection.rollback();
      return { invalidState: true };
    }

    const [reasonRows] = await connection.execute(
      `
        SELECT id, reason_text, requires_other
        FROM ad_cancellation_reasons
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [data.reason_id],
    );

    if (!reasonRows.length) {
      await connection.rollback();
      return { invalidReason: true };
    }

    const selectedReason = reasonRows[0];
    const otherReason = data.other_reason?.trim() || null;

    if (Number(selectedReason.requires_other) === 1 && !otherReason) {
      await connection.rollback();
      return { missingOtherReason: true };
    }

    // Check for an existing pending cancellation request.
    const [pendingRows] = await connection.execute(
      `
        SELECT id
        FROM ad_campaign_cancellations
        WHERE campaign_id = ?
          AND ad_id = ?
          AND user_id = ?
          AND cancelled_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [ad.campaign_id, adId, userId],
    );

    let cancellationId;

    if (pendingRows.length) {
      // Update the existing pending request instead of creating duplicates.
      cancellationId = pendingRows[0].id;

      await connection.execute(
        `
          UPDATE ad_campaign_cancellations
          SET reason_id = ?,
              other_reason = ?
          WHERE id = ?
            AND user_id = ?
            AND cancelled_at IS NULL
        `,
        [
          selectedReason.id,
          Number(selectedReason.requires_other) === 1
            ? otherReason
            : null,
          cancellationId,
          userId,
        ],
      );
    } else {
      const [insertResult] = await connection.execute(
        `
          INSERT INTO ad_campaign_cancellations (
            campaign_id,
            ad_id,
            user_id,
            reason_id,
            other_reason,
            cancelled_at
          )
          VALUES (?, ?, ?, ?, ?, NULL)
        `,
        [
          ad.campaign_id,
          adId,
          userId,
          selectedReason.id,
          Number(selectedReason.requires_other) === 1
            ? otherReason
            : null,
        ],
      );

      cancellationId = insertResult.insertId;
    }

    // IMPORTANT:
    // Do not delete the ad.
    // Do not delete the campaign.
    // Do not change either status.
    // Do not stop billing.

    await connection.commit();

    return {
      notFound: false,
      invalidState: false,
      ad_id: String(adId),
      campaign_id: String(ad.campaign_id),
      campaign_code: ad.campaign_code,
      cancellation_id: String(cancellationId),
      reason_id: Number(selectedReason.id),
      cancellation_submitted: true,
      deletion_confirmed: false,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

