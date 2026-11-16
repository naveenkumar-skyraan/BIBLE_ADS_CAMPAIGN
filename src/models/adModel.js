import db from "../configs/database/db.js";
import { decimalToMicros, microsToDecimal } from "../utils/adSpendCalculator.js";
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
            a.created_at,
            a.updated_at,
            m.id AS media_id,
            m.media_type,
            m.file_url,
            m.file_name,
            m.mime_type,
            m.file_size
        FROM ads a
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

  return rows[0] ?? null;
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
  AND status = 'draft'
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
       AND status = 'draft'
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
    ads: rows,
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
      throw createError("This ad cannot be resumed because it is under moderation.", 409);
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
    if (!ad.currency_code) throw createError("Campaign currency is missing.", 409);

    const walletId = walletRows[0].id;
    await connection.execute(
      `INSERT IGNORE INTO wallet_balances (wallet_id, currency_code, balance) VALUES (?, ?, 0.000000)`,
      [walletId, ad.currency_code],
    );
    const [balanceRows] = await connection.execute(
      `SELECT balance FROM wallet_balances WHERE wallet_id = ? AND currency_code = ? FOR UPDATE`,
      [walletId, ad.currency_code],
    );
    if (!balanceRows.length) throw createError("Wallet currency balance not found.", 404);

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
    if (adUpdate.affectedRows !== 1) throw createError("Ad could not be resumed.", 409);

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
      ORDER BY id ASC
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
          a.is_deleted AS ad_is_deleted,

          c.user_id,
          c.status AS campaign_status,
          c.is_deleted AS campaign_is_deleted

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

    if (rows.length === 0) {
      await connection.rollback();
      return { notFound: true };
    }

    const ad = rows[0];

    if (ad.ad_status !== "active" || ad.campaign_status !== "active") {
      await connection.rollback();
      return { invalidState: true };
    }

    const cancelledAt = Math.floor(Date.now() / 1000);

    // 1. Record cancellation feedback.
    const [cancellationResult] = await connection.execute(
      `
        INSERT INTO ad_campaign_cancellations (
          campaign_id,
          ad_id,
          user_id,
          reason_code,
          other_reason,
          cancelled_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        ad.campaign_id,
        ad.ad_id,
        userId,
        data.reason_code,
        data.other_reason || null,
        cancelledAt,
      ],
    );

    // 2. Soft-delete the campaign and stop billing.
    const [campaignResult] = await connection.execute(
      `
        UPDATE ad_campaigns
        SET
          is_deleted = 1,
          deleted_at = ?,
          billing_stopped_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND is_deleted = 0
          AND status = 'active'
      `,
      [cancelledAt, cancelledAt, ad.campaign_id, userId],
    );

    if (campaignResult.affectedRows !== 1) {
      throw new Error("Campaign cancellation failed.");
    }

    // 3. Soft-delete the associated ad.
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
          AND status = 'active'
      `,
      [cancelledAt, adId, userId],
    );

    if (adResult.affectedRows !== 1) {
      throw new Error("Ad cancellation failed.");
    }

    await connection.commit();

    return {
      notFound: false,
      invalidState: false,
      campaign_id: String(ad.campaign_id),
      ad_id: String(adId),
      cancellation_id: String(cancellationResult.insertId),
      cancelled_at: cancelledAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
