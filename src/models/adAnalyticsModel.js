import crypto from "node:crypto";
import pool from "../configs/database/db.js";
import { DateTime } from "luxon";
import {
  decimalToMicros,
  microsToDecimal,
  calculateAdSpend,
} from "../utils/adSpendCalculator.js";

const createError = (
  message,
  statusCode = 400,
  rejectionReason = "business_rule_rejected",
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.rejectionReason = rejectionReason;
  return error;
};

const getPayloadHash = (payload) => {
  const canonicalPayload = {
    platform: payload.platform,
    app_instance_id: payload.app_instance_id || null,
    app_version: payload.app_version || null,
    interval_start: payload.interval_start,
    interval_end: payload.interval_end,
    items: [...payload.items]
      .map(({ ad_id, impressions, clicks }) => ({
        ad_id,
        impressions,
        clicks,
      }))
      .sort((a, b) => a.ad_id - b.ad_id),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalPayload))
    .digest("hex");
};

const getCampaignLocalDate = (intervalStart, intervalEnd, timezone) => {
  const start = DateTime.fromSeconds(Number(intervalStart), {
    zone: timezone,
  });

  const end = DateTime.fromSeconds(Number(intervalEnd) - 1, {
    zone: timezone,
  });

  if (!start.isValid || !end.isValid) {
    throw createError("Invalid analytics interval or campaign timezone.");
  }

  if (start.toISODate() !== end.toISODate()) {
    throw createError(
      "Analytics intervals crossing campaign-local midnight must be split into separate batches.",
    );
  }

  return start.toISODate();
};

const getNextLocalMidnight = (localDate, timezone) => {
  return Math.floor(
    DateTime.fromISO(localDate, { zone: timezone })
      .plus({ days: 1 })
      .startOf("day")
      .toUTC()
      .toSeconds(),
  );
};

const persistRejectedBatch = async (
  connection,
  payload,
  payloadHash,
  reason,
) => {
  const [result] = await connection.execute(
    `
      INSERT INTO ad_analytics_batches (
        batch_id,
        platform,
        app_instance_id,
        app_version,
        interval_start,
        interval_end,
        payload_hash,
        processing_status,
        rejection_reason,
        rejection_payload,
        processed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?, ?, CURRENT_TIMESTAMP)
    `,
    [
      payload.batch_id,
      payload.platform,
      payload.app_instance_id || null,
      payload.app_version || null,
      payload.interval_start,
      payload.interval_end,
      payloadHash,
      reason,
      JSON.stringify(payload),
    ],
  );

  return result.insertId;
};

const getExistingBatch = async (batchId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        payload_hash,
        processing_status,
        rejection_reason
      FROM ad_analytics_batches
      WHERE batch_id = ?
      LIMIT 1
    `,
    [batchId],
  );

  return rows[0] || null;
};

const getDuplicateBatchResponse = (existing, payload, payloadHash) => {
  if (existing.payload_hash !== payloadHash) {
    throw createError(
      "This batch_id has already been used with a different payload.",
      409,
      null,
    );
  }

  return {
    duplicate: true,
    rejected: existing.processing_status === "rejected",
    batch_id: payload.batch_id,
    rejection_reason: existing.rejection_reason || null,
    message:
      existing.processing_status === "rejected"
        ? "This analytics batch was previously rejected."
        : "This analytics batch was already processed.",
  };
};

const persistRejectedBatchAfterRollback = async (
  connection,
  payload,
  payloadHash,
  reason,
  message,
) => {
  let transactionOpen = false;

  try {
    await connection.beginTransaction();
    transactionOpen = true;

    const [existingRows] = await connection.execute(
      `
        SELECT
          id,
          payload_hash,
          processing_status,
          rejection_reason
        FROM ad_analytics_batches
        WHERE batch_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [payload.batch_id],
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];

      await connection.rollback();
      transactionOpen = false;

      return getDuplicateBatchResponse(existing, payload, payloadHash);
    }

    const batchRecordId = await persistRejectedBatch(
      connection,
      payload,
      payloadHash,
      reason,
    );

    await connection.commit();
    transactionOpen = false;

    return {
      duplicate: false,
      rejected: true,
      batch_id: payload.batch_id,
      batch_record_id: batchRecordId,
      platform: payload.platform,
      reason,
      message,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rejected analytics batch rollback failed:",
          rollbackError,
        );
      }
    }

    if (error.code === "ER_DUP_ENTRY") {
      const existing = await getExistingBatch(payload.batch_id);

      if (existing) {
        return getDuplicateBatchResponse(existing, payload, payloadHash);
      }
    }

    throw error;
  }
};

const pauseCampaign = async (
  connection,
  { campaignId, adId, reason, pausedAt, resumeAt = null },
) => {
  const [result] = await connection.execute(
    `
      UPDATE ad_campaigns
      SET
        status = 'paused',
        pause_reason = ?,
        resume_at = ?,
        paused_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'active'
        AND is_deleted = 0
    `,
    [reason, resumeAt, pausedAt, campaignId],
  );

  if (result.affectedRows === 0) {
    return false;
  }

  await connection.execute(
    `
      UPDATE ads
      SET
        status = 'paused',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'active'
        AND is_deleted = 0
    `,
    [adId],
  );

  await connection.execute(
    `
      UPDATE ad_campaign_pause_history
      SET resumed_at = ?
      WHERE campaign_id = ?
        AND ad_id = ?
        AND resumed_at IS NULL
        AND paused_at <= ?
    `,
    [pausedAt, campaignId, adId, pausedAt],
  );

  await connection.execute(
    `
      INSERT INTO ad_campaign_pause_history (
        campaign_id,
        ad_id,
        pause_reason,
        paused_at
      )
      VALUES (?, ?, ?, ?)
    `,
    [campaignId, adId, reason, pausedAt],
  );

  return true;
};

const completeCampaignForBudget = async (
  connection,
  campaignId,
  adId,
  stoppedAt,
) => {
  const [result] = await connection.execute(
    `
      UPDATE ad_campaigns
      SET
        status = 'completed',
        pause_reason = NULL,
        resume_at = NULL,
        paused_at = NULL,
        billing_stopped_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status IN ('active', 'paused')
        AND is_deleted = 0
    `,
    [stoppedAt, campaignId],
  );

  if (result.affectedRows > 0) {
    await connection.execute(
      `
        UPDATE ads
        SET
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('active', 'paused')
          AND is_deleted = 0
      `,
      [adId],
    );
  }
};

export const processAdAnalyticsBatch = async (payload) => {
  const payloadHash = getPayloadHash(payload);

  const sortedItems = [...payload.items].sort((a, b) => a.ad_id - b.ad_id);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingBatches] = await connection.execute(
      `
        SELECT
          id,
          payload_hash,
          processing_status,
          rejection_reason
        FROM ad_analytics_batches
        WHERE batch_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [payload.batch_id],
    );

    if (existingBatches.length > 0) {
      const existing = existingBatches[0];

      await connection.rollback();

      if (existing.payload_hash !== payloadHash) {
        throw createError(
          "This batch_id has already been used with a different payload.",
          409,
          null,
        );
      }

      return {
        duplicate: true,
        rejected: existing.processing_status === "rejected",
        batch_id: payload.batch_id,
        rejection_reason: existing.rejection_reason || null,
        message:
          existing.processing_status === "rejected"
            ? "This analytics batch was previously rejected."
            : "This analytics batch was already processed.",
      };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (Number(payload.interval_end) > currentTimestamp) {
      // A future-ending interval is a transient submission-timing error.
      // Do not persist a rejected batch: the mobile client must be able to
      // retry this exact batch_id and payload once the interval has closed.
      throw createError(
        "Analytics interval must be completed before submission.",
        409,
        null,
      );
    }

    // Lock every affected global wallet in ascending order before locking
    // ads or campaigns. Publishing and analytics therefore serialize against
    // the same wallet row and cannot spend the same balance concurrently.
    const adIds = sortedItems.map((item) => item.ad_id);
    const adPlaceholders = adIds.map(() => "?").join(", ");
    const [walletIdRows] = await connection.execute(
      `
        SELECT DISTINCT w.id AS wallet_id
        FROM ads a
        INNER JOIN wallets w
          ON w.user_id = a.user_id
        WHERE a.id IN (${adPlaceholders})
        ORDER BY w.id
      `,
      adIds,
    );

    for (const walletRow of walletIdRows) {
      await connection.execute(
        `
          SELECT id
          FROM wallets
          WHERE id = ?
          FOR UPDATE
        `,
        [walletRow.wallet_id],
      );
    }

    const preparedItems = [];
    const walletBalances = new Map();
    const dailyPending = new Map();
    const lifetimePending = new Map();

    for (const item of sortedItems) {
      const [adRows] = await connection.execute(
        `
          SELECT
            a.id AS ad_id,
            a.campaign_id,
            a.user_id,
            a.business_id,
            a.platform AS ad_platform,
            a.status AS ad_status,
            a.moderation_status,
            a.is_deleted AS ad_is_deleted,

            c.status AS campaign_status,
            c.is_deleted AS campaign_is_deleted,
            c.budget_type,
            c.total_budget,
            c.daily_budget,
            c.start_timestamp,
            c.end_timestamp,
            c.timezone,
            c.paused_at,
            c.billing_stopped_at,
            c.currency_code AS campaign_currency_code,

            b.country_code,

            w.id AS wallet_id,
            wb.balance AS wallet_balance,

            cp.currency_code,
            cp.cpm_rate,
            cp.cpc_rate,
            cp.campaign_timezone AS pricing_timezone,
            cp.daily_budget AS pricing_daily_budget,
            cp.campaign_start_timestamp AS pricing_start_timestamp,
            cp.campaign_end_timestamp AS pricing_end_timestamp,
            cp.business_id AS pricing_business_id

          FROM ads a

          INNER JOIN ad_campaigns c
            ON c.id = a.campaign_id
            AND c.user_id = a.user_id

          INNER JOIN business_details b
            ON b.id = a.business_id
            AND b.user_id = a.user_id
            AND b.is_deleted = 0

          INNER JOIN wallets w
            ON w.user_id = a.user_id

          INNER JOIN ad_campaign_pricing cp
            ON cp.campaign_id = c.id
            AND cp.ad_id = a.id
            AND cp.platform = ?
            AND cp.effective_from_timestamp <= ?
            AND (
              cp.effective_until_timestamp IS NULL
              OR cp.effective_until_timestamp >= ?
            )

          INNER JOIN wallet_balances wb
            ON wb.wallet_id = w.id
            AND wb.currency_code = cp.currency_code

          WHERE a.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [payload.platform, payload.interval_start, payload.interval_end, item.ad_id],
      );

      if (adRows.length === 0) {
        throw createError(
          `Ad ${item.ad_id} is not configured for ${payload.platform.toUpperCase()}, or its campaign, wallet, business, or pricing snapshot is missing.`,
          404,
        );
      }

      const ad = adRows[0];

      const adIsDeleted = Number(ad.ad_is_deleted) === 1;
      const campaignIsDeleted = Number(ad.campaign_is_deleted) === 1;

      if (adIsDeleted !== campaignIsDeleted) {
        throw createError(
          `Ad ${item.ad_id} and its campaign have inconsistent deletion state.`,
          409,
        );
      }

      if (adIsDeleted && !ad.billing_stopped_at) {
        throw createError(
          `Ad ${item.ad_id} was deleted without a recorded billing-stop time.`,
          409,
        );
      }

      if (
        adIsDeleted &&
        Number(payload.interval_end) > Number(ad.billing_stopped_at)
      ) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} extends beyond its cancellation time.`,
          409,
        );
      }

      const allowedPlatforms =
        ad.ad_platform === "both" ? ["android", "ios"] : [ad.ad_platform];

      if (!allowedPlatforms.includes(payload.platform)) {
        throw createError(
          `Ad ${item.ad_id} is not eligible for ${payload.platform.toUpperCase()}.`,
          409,
        );
      }

      const [moderationEvents] = await connection.execute(
        `
          SELECT
            event_type,
            UNIX_TIMESTAMP(created_at) AS event_timestamp
          FROM ad_moderation_history
          WHERE ad_id = ?
            AND user_id = ?
            AND event_type IN ('blocked', 'approved')
          ORDER BY id DESC
        `,
        [item.ad_id, ad.user_id],
      );

      let moderationStartedAt = null;
      let moderationWindowOverlap = false;

      for (const event of moderationEvents) {
        const eventTimestamp = Number(event.event_timestamp);

        if (event.event_type === "blocked") {
          moderationStartedAt = eventTimestamp;
          continue;
        }

        if (event.event_type === "approved" && moderationStartedAt !== null) {
          if (
            moderationStartedAt < Number(payload.interval_end) &&
            eventTimestamp > Number(payload.interval_start)
          ) {
            moderationWindowOverlap = true;
            break;
          }

          moderationStartedAt = null;
        }
      }

      if (
        moderationWindowOverlap ||
        (moderationStartedAt !== null &&
          moderationStartedAt < Number(payload.interval_end))
      ) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} overlaps a moderation block period.`,
          409,
          "moderation_window_overlap",
        );
      }

      if (ad.moderation_status !== "none" && moderationStartedAt === null) {
        throw createError(
          `Ad ${item.ad_id} is under moderation but its moderation history is incomplete.`,
          409,
          "moderation_history_incomplete",
        );
      }

      if (
        !["active", "paused", "completed"].includes(ad.ad_status) ||
        !["active", "paused", "completed"].includes(ad.campaign_status)
      ) {
        throw createError(
          `Ad ${item.ad_id} or its campaign has not been published.`,
          409,
        );
      }

      if (
        !ad.pricing_start_timestamp ||
        !ad.pricing_end_timestamp ||
        Number(payload.interval_start) < Number(ad.pricing_start_timestamp) ||
        Number(payload.interval_end) - 1 > Number(ad.pricing_end_timestamp)
      ) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} is outside its campaign schedule.`,
          409,
        );
      }

      if (
        ad.campaign_status === "paused" &&
        ad.paused_at &&
        Number(payload.interval_end) > Number(ad.paused_at)
      ) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} extends beyond its campaign pause time.`,
          409,
        );
      }

      if (
        ad.billing_stopped_at &&
        Number(payload.interval_end) > Number(ad.billing_stopped_at)
      ) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} extends beyond its billing-stop time.`,
          409,
        );
      }

      const [pauseWindows] = await connection.execute(
        `
          SELECT id
          FROM ad_campaign_pause_history
          WHERE campaign_id = ?
            AND ad_id = ?
            AND paused_at < ?
            AND (
              resumed_at IS NULL
              OR resumed_at > ?
            )
          LIMIT 1
          FOR UPDATE
        `,
        [
          ad.campaign_id,
          item.ad_id,
          payload.interval_end,
          payload.interval_start,
        ],
      );

      if (pauseWindows.length > 0) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} overlaps a campaign pause period.`,
          409,
        );
      }

      const localDate = getCampaignLocalDate(
        payload.interval_start,
        payload.interval_end,
        ad.pricing_timezone,
      );

      const [overlappingIntervals] = await connection.execute(
        `
          SELECT id
          FROM ad_analytics_batch_items
          WHERE platform = ?
            AND ad_id = ?
            AND interval_start < ?
            AND interval_end > ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          payload.platform,
          item.ad_id,
          payload.interval_end,
          payload.interval_start,
        ],
      );

      if (overlappingIntervals.length > 0) {
        throw createError(
          `An overlapping analytics interval already exists for ad ${item.ad_id} on ${payload.platform}.`,
          409,
        );
      }

      const charges = calculateAdSpend({
        impressions: item.impressions,
        clicks: item.clicks,
        cpmRate: ad.cpm_rate,
        cpcRate: ad.cpc_rate,
      });

      const walletId = Number(ad.wallet_id);
      const campaignId = Number(ad.campaign_id);
      const walletKey = `${walletId}:${ad.currency_code}`;
      const walletBefore = walletBalances.has(walletKey)
        ? walletBalances.get(walletKey)
        : decimalToMicros(ad.wallet_balance);

      const walletAfter = walletBefore - charges.walletDebitMicros;

      const dailyKey = `${campaignId}:${localDate}`;
      const pendingDaily = dailyPending.get(dailyKey) || 0n;

      const lifetimeKey = String(campaignId);
      const pendingLifetime = lifetimePending.get(lifetimeKey) || 0n;

      const [dailyRows] = await connection.execute(
        `
          SELECT COALESCE(SUM(total_charge), 0) AS spent
          FROM ad_campaign_daily_spend
          WHERE campaign_id = ?
            AND currency_code = ?
            AND campaign_local_date = ?
        `,
        [campaignId, ad.currency_code, localDate],
      );

      const [lifetimeRows] = await connection.execute(
        `
          SELECT COALESCE(SUM(total_charge), 0) AS spent
          FROM ad_campaign_daily_spend
          WHERE campaign_id = ?
            AND currency_code = ?
        `,
        [campaignId, ad.currency_code],
      );

      const dailySpent = decimalToMicros(dailyRows[0].spent);
      const lifetimeSpent = decimalToMicros(lifetimeRows[0].spent);

      const dailyBudget =
        ad.pricing_daily_budget === null ? null : decimalToMicros(ad.pricing_daily_budget);

      const totalBudget = decimalToMicros(ad.total_budget);

      const dailyTotalAfter = dailySpent + pendingDaily + charges.totalMicros;

      const lifetimeTotalAfter =
        lifetimeSpent + pendingLifetime + charges.totalMicros;

      if (dailyBudget !== null && dailyTotalAfter > dailyBudget) {
        const resumeAt = getNextLocalMidnight(localDate, ad.pricing_timezone);

        if (!adIsDeleted) {
          await pauseCampaign(connection, {
            campaignId,
            adId: item.ad_id,
            reason: "daily_budget",
            pausedAt: Number(payload.interval_start),
            resumeAt,
          });
        }

        const rejectedBatchId = await persistRejectedBatch(
          connection,
          payload,
          payloadHash,
          "daily_budget_exceeded",
        );

        await connection.commit();

        return {
          rejected: true,
          batch_id: payload.batch_id,
          batch_record_id: rejectedBatchId,
          reason: "daily_budget_exceeded",
          message: adIsDeleted
            ? "The batch exceeds the campaign daily budget and was rejected. The cancelled campaign was not modified."
            : "The batch exceeds the campaign daily budget. The campaign was paused until the next campaign-local day.",
          ad_id: item.ad_id,
          ...(!adIsDeleted ? { resume_at: resumeAt } : {}),
        };
      }

      if (lifetimeTotalAfter > totalBudget) {
        if (!adIsDeleted) {
          await completeCampaignForBudget(
            connection,
            campaignId,
            item.ad_id,
            Number(payload.interval_start),
          );
        }

        const rejectedBatchId = await persistRejectedBatch(
          connection,
          payload,
          payloadHash,
          "lifetime_budget_exceeded",
        );

        await connection.commit();

        return {
          rejected: true,
          batch_id: payload.batch_id,
          batch_record_id: rejectedBatchId,
          reason: "lifetime_budget_exceeded",
          message: adIsDeleted
            ? "The batch exceeds the campaign total budget and was rejected. The cancelled campaign was not modified."
            : "The batch exceeds the campaign total budget. The campaign was completed.",
          ad_id: item.ad_id,
        };
      }

      if (walletBefore < charges.walletDebitMicros) {
        const pauseTimestamp = Number(payload.interval_end);
        if (!adIsDeleted) {
          await pauseCampaign(connection, {
            campaignId,
            adId: item.ad_id,
            reason: "wallet_insufficient",
            pausedAt: pauseTimestamp,
            resumeAt: null,
          });
        }

        const rejectedBatchId = await persistRejectedBatch(
          connection,
          payload,
          payloadHash,
          "wallet_insufficient",
        );

        await connection.commit();

        return {
          rejected: true,
          batch_id: payload.batch_id,
          batch_record_id: rejectedBatchId,
          reason: "wallet_insufficient",
          message: adIsDeleted
            ? "The wallet balance is insufficient. The batch was rejected without billing; the cancelled campaign was not modified."
            : "The wallet balance is insufficient. The campaign was paused at the end of this interval. Add funds and resume the campaign; submit the unbilled interval again with a new batch_id.",
          ad_id: item.ad_id,
          currency: ad.currency_code,
          available_balance: microsToDecimal(walletBefore),
          required_amount: microsToDecimal(charges.walletDebitMicros),
          ...(!adIsDeleted ? { paused_at: pauseTimestamp } : {}),
        };
      }

      walletBalances.set(walletKey, walletAfter);

      dailyPending.set(dailyKey, pendingDaily + charges.totalMicros);

      lifetimePending.set(lifetimeKey, pendingLifetime + charges.totalMicros);

      preparedItems.push({
        ...item,
        ad,
        localDate,
        charges,
        walletBefore,
        walletAfter,
        walletKey,
        dailyTotalAfter,
        lifetimeTotalAfter,
      });
    }

    const [batchResult] = await connection.execute(
      `
        INSERT INTO ad_analytics_batches (
          batch_id,
          platform,
          app_instance_id,
          app_version,
          interval_start,
          interval_end,
          payload_hash,
          processing_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'processed')
      `,
      [
        payload.batch_id,
        payload.platform,
        payload.app_instance_id || null,
        payload.app_version || null,
        payload.interval_start,
        payload.interval_end,
        payloadHash,
      ],
    );

    const batchRecordId = batchResult.insertId;

    const processedItems = [];
    const batchTotalsByCurrency = new Map();

    for (const prepared of preparedItems) {
      const { ad, localDate, charges } = prepared;

      const [itemResult] = await connection.execute(
        `
          INSERT INTO ad_analytics_batch_items (
            batch_record_id,
            platform,
            ad_id,
            campaign_id,
            business_id,
            user_id,
            wallet_id,
            interval_start,
            interval_end,
            campaign_local_date,
            impressions,
            clicks,
            currency_code,
            cpm_rate_applied,
            cpc_rate_applied,
            impression_charge,
            click_charge,
            total_charge,
            platform_fee,
            gst_amount,
            wallet_debit
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          batchRecordId,
          payload.platform,
          prepared.ad_id,
          ad.campaign_id,
          ad.pricing_business_id,
          ad.user_id,
          ad.wallet_id,
          payload.interval_start,
          payload.interval_end,
          localDate,
          prepared.impressions,
          prepared.clicks,
          ad.currency_code,
          ad.cpm_rate,
          ad.cpc_rate,
          microsToDecimal(charges.impressionMicros),
          microsToDecimal(charges.clickMicros),
          microsToDecimal(charges.totalMicros),
          microsToDecimal(charges.platformFeeMicros),
          microsToDecimal(charges.gstMicros),
          microsToDecimal(charges.walletDebitMicros),
        ],
      );

      const itemRecordId = itemResult.insertId;

      const currencyTotals = batchTotalsByCurrency.get(ad.currency_code) || {
        totalCharge: 0n,
        platformFee: 0n,
        gst: 0n,
        walletDebit: 0n,
      };
      currencyTotals.totalCharge += charges.totalMicros;
      currencyTotals.platformFee += charges.platformFeeMicros;
      currencyTotals.gst += charges.gstMicros;
      currencyTotals.walletDebit += charges.walletDebitMicros;
      batchTotalsByCurrency.set(ad.currency_code, currencyTotals);

      if (charges.walletDebitMicros > 0n) {
        const [walletUpdate] = await connection.execute(
          `
            UPDATE wallet_balances
            SET
              balance = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE wallet_id = ?
              AND currency_code = ?
              AND balance = ?
          `,
          [
            microsToDecimal(prepared.walletAfter),
            ad.wallet_id,
            ad.currency_code,
            microsToDecimal(prepared.walletBefore),
          ],
        );

        if (walletUpdate.affectedRows !== 1) {
          throw createError(
            "Wallet currency balance changed during analytics processing. Retry the batch.",
            409,
            null,
          );
        }

        if (ad.currency_code === "INR") {
          await connection.execute(
            `UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [microsToDecimal(prepared.walletAfter), ad.wallet_id],
          );
        }

        await connection.execute(
          `
            INSERT INTO wallet_transactions (
              wallet_id,
              user_id,
              business_id,
              campaign_id,
              transaction_type,
              transaction_direction,
              amount,
              currency_code,
              ad_spend_amount,
              platform_fee,
              gst_amount,
              balance_before,
              balance_after,
              reference_id,
              reference_type,
              description
            )
            VALUES (
              ?, ?, ?, ?,
              'ad_spend',
              'debit',
              ?, ?, ?, ?, ?, ?, ?,
              ?,
              'ad_analytics_batch_item',
              ?
            )
          `,
          [
            ad.wallet_id,
            ad.user_id,
            ad.pricing_business_id,
            ad.campaign_id,
            microsToDecimal(charges.walletDebitMicros),
            ad.currency_code,
            microsToDecimal(charges.totalMicros),
            microsToDecimal(charges.platformFeeMicros),
            microsToDecimal(charges.gstMicros),
            microsToDecimal(prepared.walletBefore),
            microsToDecimal(prepared.walletAfter),
            itemRecordId,
            `Ad spend for campaign ${ad.campaign_id} (${payload.platform})`,
          ],
        );
      }

      await connection.execute(
        `
          INSERT INTO ad_campaign_daily_spend (
            campaign_id,
            ad_id,
            user_id,
            business_id,
            wallet_id,
            platform,
            campaign_timezone,
            campaign_local_date,
            currency_code,
            impressions,
            clicks,
            impression_charge,
            click_charge,
            total_charge,
            platform_fee,
            gst_amount,
            wallet_debit
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

          ON DUPLICATE KEY UPDATE
            impressions = impressions + VALUES(impressions),
            clicks = clicks + VALUES(clicks),
            impression_charge =
              impression_charge + VALUES(impression_charge),
            click_charge =
              click_charge + VALUES(click_charge),
            total_charge =
              total_charge + VALUES(total_charge),
            platform_fee = platform_fee + VALUES(platform_fee),
            gst_amount = gst_amount + VALUES(gst_amount),
            wallet_debit = wallet_debit + VALUES(wallet_debit),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          ad.campaign_id,
          prepared.ad_id,
          ad.user_id,
          ad.pricing_business_id,
          ad.wallet_id,
          payload.platform,
          ad.pricing_timezone,
          localDate,
          ad.currency_code,
          prepared.impressions,
          prepared.clicks,
          microsToDecimal(charges.impressionMicros),
          microsToDecimal(charges.clickMicros),
          microsToDecimal(charges.totalMicros),
          microsToDecimal(charges.platformFeeMicros),
          microsToDecimal(charges.gstMicros),
          microsToDecimal(charges.walletDebitMicros),
        ],
      );

      const adIsDeleted = Number(ad.ad_is_deleted) === 1;

      if (!adIsDeleted) {
        if (prepared.lifetimeTotalAfter >= decimalToMicros(ad.total_budget)) {
          await completeCampaignForBudget(
            connection,
            ad.campaign_id,
            prepared.ad_id,
            Number(payload.interval_end),
          );
        } else if (
          ad.pricing_daily_budget !== null &&
          prepared.dailyTotalAfter >= decimalToMicros(ad.pricing_daily_budget)
        ) {
          await pauseCampaign(connection, {
            campaignId: ad.campaign_id,
            adId: prepared.ad_id,
            reason: "daily_budget",
            pausedAt: Number(payload.interval_end),
            resumeAt: getNextLocalMidnight(localDate, ad.pricing_timezone),
          });
        }
      }

      processedItems.push({
        ad_id: prepared.ad_id,
        impressions: prepared.impressions,
        clicks: prepared.clicks,
        impression_charge: microsToDecimal(charges.impressionMicros),
        click_charge: microsToDecimal(charges.clickMicros),
        total_charge: microsToDecimal(charges.totalMicros),
        platform_fee: microsToDecimal(charges.platformFeeMicros),
        gst_amount: microsToDecimal(charges.gstMicros),
        wallet_debit: microsToDecimal(charges.walletDebitMicros),
        currency: ad.currency_code,
      });
    }

    await connection.execute(
      `
        UPDATE ad_analytics_batches
        SET processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [batchRecordId],
    );

    await connection.commit();

    const currencyTotals = [...batchTotalsByCurrency.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currencyCode, totals]) => ({
        currency: currencyCode,
        total_charge: microsToDecimal(totals.totalCharge),
        total_platform_fee: microsToDecimal(totals.platformFee),
        total_gst: microsToDecimal(totals.gst),
        total_wallet_debit: microsToDecimal(totals.walletDebit),
      }));
    const singleCurrency = currencyTotals.length === 1 ? currencyTotals[0] : null;

    return {
      duplicate: false,
      rejected: false,
      batch_id: payload.batch_id,
      batch_record_id: batchRecordId,
      platform: payload.platform,
      processed_items: processedItems,
      // Top-level money totals are populated only when the batch has one
      // currency. Mixed-currency batches must be consumed via currency_totals.
      total_charge: singleCurrency?.total_charge ?? null,
      total_platform_fee: singleCurrency?.total_platform_fee ?? null,
      total_gst: singleCurrency?.total_gst ?? null,
      total_wallet_debit: singleCurrency?.total_wallet_debit ?? null,
      currency: singleCurrency?.currency ?? null,
      currency_totals: currencyTotals,
    };
    } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Analytics transaction rollback failed:", rollbackError);
    }

    if (error.code === "ER_DUP_ENTRY") {
      const existingBatch = await getExistingBatch(payload.batch_id);

      if (existingBatch) {
        return getDuplicateBatchResponse(
          existingBatch,
          payload,
          payloadHash,
        );
      }

      const duplicateKey = String(
        error.sqlMessage || error.message || "",
      );

      if (
        duplicateKey.includes("uq_platform_ad_interval") ||
        duplicateKey.includes("uq_batch_ad_interval")
      ) {
        error.statusCode = 409;
        error.rejectionReason = "overlapping_interval";
        error.message =
          "An overlapping analytics interval already exists for this ad and platform.";
      } else {
        throw createError(
          "This analytics interval or batch has already been processed.",
          409,
          null,
        );
      }
    }

    if (error.rejectionReason) {
      return await persistRejectedBatchAfterRollback(
        connection,
        payload,
        payloadHash,
        error.rejectionReason,
        error.message,
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}