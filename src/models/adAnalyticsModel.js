import crypto from "node:crypto";
import pool from "../configs/database/db.js";
import { DateTime } from "luxon";
import {
  decimalToMicros,
  microsToDecimal,
  calculateAdSpend,
} from "../utils/adSpendCalculator.js";
import {
  capAdEventsToSpendLimit,
  getMaxBaseSpendForWalletBalance,
} from "../utils/adSpendLimits.js";
import { inspectModerationInterval } from "../utils/adModerationHistory.js";

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

const getExistingBatch = async (batchId, connection = pool) => {
  const [rows] = await connection.execute(
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

const getDuplicateBatchResponse = async (connection, existing, payload, payloadHash) => {
  if (existing.payload_hash !== payloadHash) {
    throw createError(
      "This batch_id has already been used with a different payload.",
      409,
      null,
    );
  }

  let mobileActions = [];
  if (existing.processing_status === "processed") {
    const [actionRows] = await connection.execute(
      `SELECT ad_id, mobile_action AS action, limit_reason AS reason, resume_at
       FROM ad_analytics_batch_items
       WHERE batch_record_id = ? AND mobile_action IS NOT NULL
       ORDER BY id ASC`,
      [existing.id],
    );
    mobileActions = actionRows.map((row) => ({
      ad_id: Number(row.ad_id),
      action: row.action,
      reason: row.reason,
      ...(row.resume_at ? { resume_at: Number(row.resume_at) } : {}),
    }));
  }

  return {
    duplicate: true,
    rejected: existing.processing_status === "rejected",
    batch_id: payload.batch_id,
    rejection_reason: existing.rejection_reason || null,
    mobile_actions: mobileActions,
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

      return await getDuplicateBatchResponse(connection, existing, payload, payloadHash);
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
      const existing = await getExistingBatch(payload.batch_id, connection);

      if (existing) {
        return await getDuplicateBatchResponse(connection, existing, payload, payloadHash);
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

      return await getDuplicateBatchResponse(
        connection,
        existing,
        payload,
        payloadHash,
      );
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
            cp.effective_until_timestamp AS pricing_effective_until_timestamp,
            cp.cpm_rate,
            cp.cpc_rate,
            cp.tax_rate AS pricing_tax_rate,
            cp.platform_fee_rate AS pricing_platform_fee_rate,
            cp.tax_name AS pricing_tax_name,
            cp.tax_basis AS pricing_tax_basis,
            cp.campaign_timezone AS pricing_timezone,
            cp.daily_budget AS pricing_daily_budget,
            cp.total_budget AS pricing_total_budget,
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
              OR cp.effective_until_timestamp > ?
            )

          INNER JOIN wallet_balances wb
            ON wb.wallet_id = w.id
            AND wb.currency_code = cp.currency_code

          WHERE a.id = ?
          ORDER BY cp.effective_from_timestamp DESC, cp.id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [
          payload.platform,
          payload.interval_start,
          payload.interval_start,
          item.ad_id,
        ],
      );

      if (adRows.length === 0) {
        throw createError(
          `Ad ${item.ad_id} is not configured for ${payload.platform.toUpperCase()}, or its campaign, wallet, business, or pricing snapshot is missing.`,
          404,
        );
      }

      const ad = adRows[0];

      // A batch must belong entirely to one pricing/configuration version.
      // Reject boundary-crossing intervals so the mobile client can split the
      // interval and submit each side under its correct immutable snapshot.
      if (
        ad.pricing_effective_until_timestamp !== null &&
        Number(payload.interval_end) > Number(ad.pricing_effective_until_timestamp)
      ) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} crosses a campaign pricing-change boundary. Split the interval and submit each part separately.`,
          409,
          "pricing_snapshot_boundary_overlap",
        );
      }

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
          ORDER BY created_at ASC, id ASC
        `,
        [item.ad_id, ad.user_id],
      );

      const moderationState = inspectModerationInterval(
        moderationEvents,
        payload.interval_start,
        payload.interval_end,
      );

      if (moderationState.overlaps) {
        throw createError(
          `Analytics interval for ad ${item.ad_id} overlaps a moderation block period.`,
          409,
          "moderation_window_overlap",
        );
      }

      if (ad.moderation_status !== "none" && !moderationState.hasOpenModeration) {
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

      const walletId = Number(ad.wallet_id);
      const campaignId = Number(ad.campaign_id);
      const walletKey = `${walletId}:${ad.currency_code}`;
      const walletBefore = walletBalances.has(walletKey)
        ? walletBalances.get(walletKey)
        : decimalToMicros(ad.wallet_balance);

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
      const dailyBudget = ad.pricing_daily_budget === null
        ? null
        : decimalToMicros(ad.pricing_daily_budget);
      const totalBudget = decimalToMicros(ad.pricing_total_budget);

      const dailyRemaining = dailyBudget === null
        ? null
        : (dailyBudget > dailySpent + pendingDaily
            ? dailyBudget - dailySpent - pendingDaily
            : 0n);
      const lifetimeRemaining = totalBudget > lifetimeSpent + pendingLifetime
        ? totalBudget - lifetimeSpent - pendingLifetime
        : 0n;
      const platformFeePercent = Number(ad.pricing_platform_fee_rate ?? 30);
      const taxPercent = Number(ad.pricing_tax_rate ?? 0);
      const walletBaseRemaining = getMaxBaseSpendForWalletBalance(
        walletBefore,
        platformFeePercent,
        taxPercent,
      );

      // The first reached limit wins. Ties prefer campaign completion, then
      // daily pause, then insufficient-wallet pause.
      const limits = [
        { reason: "lifetime_budget", remaining: lifetimeRemaining, priority: 0 },
        ...(dailyRemaining === null
          ? []
          : [{ reason: "daily_budget", remaining: dailyRemaining, priority: 1 }]),
        { reason: "wallet_insufficient", remaining: walletBaseRemaining, priority: 2 },
      ].sort((a, b) =>
        a.remaining === b.remaining
          ? a.priority - b.priority
          : a.remaining < b.remaining ? -1 : 1,
      );
      const limitingBudget = limits[0];

      const capped = capAdEventsToSpendLimit({
        impressions: item.impressions,
        clicks: item.clicks,
        cpmRate: ad.cpm_rate,
        cpcRate: ad.cpc_rate,
        maxSpendMicros: limitingBudget.remaining,
        platformFeePercent,
        gstPercent: taxPercent,
      });
      const charges = capped.charges;
      const wasCapped = capped.wasCapped;
      const hasReportedBillableEvents =
        Number(item.impressions) > 0 || Number(item.clicks) > 0;
      const limitReached = hasReportedBillableEvents &&
        calculateAdSpend({
          impressions: item.impressions,
          clicks: item.clicks,
          cpmRate: ad.cpm_rate,
          cpcRate: ad.cpc_rate,
          platformFeePercent,
          gstPercent: taxPercent,
        }).totalMicros >= limitingBudget.remaining;
      const limitAction = limitReached ? limitingBudget.reason : null;

      const walletAfter = walletBefore - charges.walletDebitMicros;
      if (walletAfter < 0n) {
        throw createError(
          "Wallet spend cap could not be enforced safely. No wallet debit was committed.",
          409,
          null,
        );
      }

      const dailyTotalAfter = dailySpent + pendingDaily + charges.totalMicros;
      const lifetimeTotalAfter =
        lifetimeSpent + pendingLifetime + charges.totalMicros;
      const resumeAt = limitAction === "daily_budget"
        ? getNextLocalMidnight(localDate, ad.pricing_timezone)
        : null;

      walletBalances.set(walletKey, walletAfter);
      dailyPending.set(dailyKey, pendingDaily + charges.totalMicros);
      lifetimePending.set(lifetimeKey, pendingLifetime + charges.totalMicros);

      preparedItems.push({
        ...item,
        reportedImpressions: Number(item.impressions),
        reportedClicks: Number(item.clicks),
        impressions: capped.impressions,
        clicks: capped.clicks,
        ad,
        localDate,
        charges,
        walletBefore,
        walletAfter,
        walletKey,
        dailyTotalAfter,
        lifetimeTotalAfter,
        wasCapped,
        cappingReason: wasCapped ? limitingBudget.reason : null,
        limitReason: limitAction,
        limitAction,
        resumeAt,
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
      const expectedMobileAction = Number(ad.ad_is_deleted) === 1
        ? null
        : prepared.limitAction === "lifetime_budget"
          ? "stop_ad"
          : prepared.limitAction
            ? "pause_ad"
            : null;

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
            reported_impressions,
            clicks,
            reported_clicks,
            is_capped,
            capping_reason,
            limit_reason,
            mobile_action,
            resume_at,
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
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          prepared.reportedImpressions,
          prepared.clicks,
          prepared.reportedClicks,
          prepared.wasCapped ? 1 : 0,
          prepared.cappingReason,
          prepared.limitReason,
          expectedMobileAction,
          prepared.resumeAt,
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
      let mobileAction = expectedMobileAction;

      if (!adIsDeleted && prepared.limitAction === "lifetime_budget") {
        await completeCampaignForBudget(
          connection,
          ad.campaign_id,
          prepared.ad_id,
          Number(payload.interval_end),
        );
        mobileAction = "stop_ad";
      } else if (!adIsDeleted && prepared.limitAction) {
        await pauseCampaign(connection, {
          campaignId: ad.campaign_id,
          adId: prepared.ad_id,
          reason: prepared.limitAction,
          pausedAt: Number(payload.interval_end),
          resumeAt: prepared.resumeAt,
        });
        mobileAction = "pause_ad";
      }

      processedItems.push({
        ad_id: prepared.ad_id,
        impressions: prepared.impressions,
        clicks: prepared.clicks,
        reported_impressions: prepared.reportedImpressions,
        reported_clicks: prepared.reportedClicks,
        analytics_capped: prepared.wasCapped,
        capping_reason: prepared.cappingReason,
        limit_reason: prepared.limitReason,
        limit_reached: Boolean(prepared.limitAction),
        mobile_action: mobileAction,
        ...(prepared.resumeAt ? { resume_at: prepared.resumeAt } : {}),
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
      mobile_actions: processedItems
        .filter((item) => item.mobile_action)
        .map((item) => ({
          ad_id: item.ad_id,
          action: item.mobile_action,
          reason: item.limit_reason,
          ...(item.resume_at ? { resume_at: item.resume_at } : {}),
        })),
    };
    } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Analytics transaction rollback failed:", rollbackError);
    }

    if (error.code === "ER_DUP_ENTRY") {
      const existingBatch = await getExistingBatch(payload.batch_id, connection);

      if (existingBatch) {
        return await getDuplicateBatchResponse(
          connection,
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