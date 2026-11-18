
import pool from "../configs/database/db.js";
import {
  decimalToMicros,
  microsToDecimal,
} from "../utils/adSpendCalculator.js";
import { getCurrencyForCountry } from "../utils/currencyConfig.js";
import { insertCampaignWithUniqueCode } from "../utils/campaignCode.js";
import {
  calculateWalletPayableMicros,
  getWalletCommitmentSummary,
} from "../utils/campaignWalletFunding.js";

const createError = (message, statusCode, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const validateTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    throw createError("Invalid campaign timezone.", 400);
  }
};

const getApplicablePricingRule = async (
  connection,
  billingModel,
  ad,
  platform,
) => {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        billing_model,
        currency_code,
        rate,
        effective_from,
        effective_until
      FROM ad_pricing_rules
      WHERE billing_model = ?
        AND currency_code = ?
        AND is_active = 1

        AND effective_from <= CURRENT_TIMESTAMP()
        AND (
          effective_until IS NULL
          OR effective_until >= CURRENT_TIMESTAMP()
        )

        AND (objective_id IS NULL OR objective_id = ?)
        AND (ad_type_id IS NULL OR ad_type_id = ?)
        AND (ad_subtype_id IS NULL OR ad_subtype_id = ?)

        AND (country_code IS NULL OR country_code = ?)
        AND (admin_area_1 IS NULL OR admin_area_1 = ?)
        AND (city IS NULL OR city = ?)

        AND (platform = ? OR platform = 'all')

      ORDER BY
        (
          (objective_id IS NOT NULL) +
          (ad_type_id IS NOT NULL) +
          (ad_subtype_id IS NOT NULL) +
          (country_code IS NOT NULL) +
          (admin_area_1 IS NOT NULL) +
          (city IS NOT NULL)
        ) DESC,
        (platform = ?) DESC,
        effective_from DESC,
        id DESC

      LIMIT 1
    `,
    [
      billingModel,
      ad.currency_code,
      ad.objective_id,
      ad.ad_type_id,
      ad.ad_subtype_id,
      ad.country_code,
      ad.admin_area_1,
      ad.city,
      platform,
      platform,
    ],
  );

  if (rows.length === 0) {
    throw createError(
      `No active ${billingModel.toUpperCase()} pricing rule found for ${platform}.`,
      400,
    );
  }

  return rows[0];
};

const saveCampaign = async (adId, userId, data, schedule = null) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ads] = await connection.execute(
      `
        SELECT
          id,
          business_id,
          campaign_id,
          status
        FROM ads
        WHERE id = ?
          AND user_id = ?
          AND status IN ('draft', 'active', 'paused')
          AND moderation_status <> 'under_review'
          AND is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (ads.length === 0) {
      throw createError("Draft ad not found or you do not own this ad.", 404);
    }

    const ad = ads[0];
    let campaignId = ad.campaign_id;
    const startDate = data.start_date || null;
    const endDate = data.end_date || null;
    const timezone = validateTimezone(data.timezone);
    let isScheduledEdit = false;

    if (campaignId) {
      const [campaignRows] = await connection.execute(
        `
          SELECT
            id,
            status,
            start_timestamp,
            end_timestamp,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
            (
              SELECT COUNT(*)
              FROM ad_campaign_pricing p
              WHERE p.campaign_id = ad_campaigns.id
            ) AS pricing_count
          FROM ad_campaigns
          WHERE id = ?
            AND user_id = ?
            AND is_deleted = 0
          LIMIT 1
          FOR UPDATE
        `,
        [campaignId, userId],
      );

      if (campaignRows.length === 0) {
        throw createError("Campaign not found.", 404);
      }

      const existingCampaign = campaignRows[0];
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const hasPricing = Number(existingCampaign.pricing_count) > 0;

      isScheduledEdit =
        ad.status === "draft" &&
        existingCampaign.status === "draft" &&
        hasPricing &&
        Number(existingCampaign.start_timestamp) > nowTimestamp &&
        Number(existingCampaign.end_timestamp) >= nowTimestamp;

      const isUnpublishedDraft =
        ad.status === "draft" &&
        existingCampaign.status === "draft" &&
        !hasPricing &&
        !existingCampaign.start_timestamp &&
        !existingCampaign.end_timestamp;

      if (isScheduledEdit && !schedule) {
        throw createError(
          "A valid replacement schedule is required to update this scheduled campaign.",
          400,
        );
      }

      const isLiveCampaignEdit =
        ["active", "paused"].includes(ad.status) &&
        existingCampaign.status === ad.status &&
        hasPricing;

      if (!isScheduledEdit && !isUnpublishedDraft && !isLiveCampaignEdit) {
        throw createError(
          "Only draft, active or paused campaigns can be edited.",
          409,
        );
      }

      if (isLiveCampaignEdit) {
        if (!schedule) {
          throw createError("A valid replacement campaign schedule is required.", 400);
        }
        const liveSchedule = {
          ...schedule,
          campaignStatus: ad.status,
        };
        const now = Math.floor(Date.now() / 1000);
        if (
          ad.status === "active" &&
          (liveSchedule.startTimestamp > now || liveSchedule.endTimestamp < now)
        ) {
          throw createError(
            "An active campaign must remain within an active campaign period. Pause it before scheduling a future start date.",
            409,
          );
        }
        const [walletRows] = await connection.execute(
          `SELECT id FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
          [userId],
        );
        if (!walletRows.length) throw createError("Wallet not found.", 404);
        const wallet = walletRows[0];

        await connection.execute(
          `INSERT IGNORE INTO wallet_balances (wallet_id, currency_code, balance)
           VALUES (?, ?, 0.000000)`,
          [wallet.id, data.currency_code],
        );
        const [balanceRows] = await connection.execute(
          `SELECT balance FROM wallet_balances
           WHERE wallet_id = ? AND currency_code = ? FOR UPDATE`,
          [wallet.id, data.currency_code],
        );
        if (!balanceRows.length) throw createError("Wallet currency balance not found.", 404);

        const [spendRows] = await connection.execute(
          `SELECT COALESCE(SUM(total_charge), 0) AS spent
           FROM ad_campaign_daily_spend
           WHERE campaign_id = ? AND currency_code = ?`,
          [campaignId, data.currency_code],
        );
        const spentMicros = decimalToMicros(spendRows[0].spent || 0);
        const newBudgetMicros = decimalToMicros(data.total_budget);
        if (newBudgetMicros < spentMicros) {
          throw createError(
            "The updated campaign budget cannot be lower than the amount already spent.",
            400,
            {
              spent_amount: Number(microsToDecimal(spentMicros)),
              minimum_total_budget: Number(microsToDecimal(spentMicros)),
              currency: data.currency_code,
            },
          );
        }

        const outstanding = await getWalletCommitmentSummary(
          connection, userId, now, data.currency_code, campaignId,
        );
        const remainingBudgetMicros = newBudgetMicros - spentMicros;
        const campaignPayable = calculateWalletPayableMicros(remainingBudgetMicros);
        const requiredWalletMicros =
          outstanding.committedPayableMicros + campaignPayable.payableMicros;
        const availableWalletMicros = decimalToMicros(balanceRows[0].balance);
        if (availableWalletMicros < requiredWalletMicros) {
          throw createError(
            "Insufficient wallet balance for the updated campaign budget and your other published campaigns.",
            400,
            {
              available_balance: Number(microsToDecimal(availableWalletMicros)),
              existing_campaign_commitment: Number(outstanding.committedPayable),
              current_campaign_required: Number(microsToDecimal(campaignPayable.payableMicros)),
              total_required: Number(microsToDecimal(requiredWalletMicros)),
              additional_amount_required: Number(microsToDecimal(requiredWalletMicros - availableWalletMicros)),
              currency: data.currency_code,
            },
          );
        }

        const [pricingAdRows] = await connection.execute(
          `SELECT a.id, a.platform, a.objective_id, a.ad_type_id, a.ad_subtype_id,
                  bd.country_code, bd.admin_area_1, bd.city
           FROM ads a
           INNER JOIN business_details bd
             ON bd.id = a.business_id AND bd.user_id = a.user_id AND bd.is_deleted = 0
           WHERE a.id = ? AND a.user_id = ? AND a.is_deleted = 0
           LIMIT 1`,
          [adId, userId],
        );
        if (!pricingAdRows.length) throw createError("Ad pricing details could not be retrieved.", 404);
        const pricingAd = { ...pricingAdRows[0], currency_code: data.currency_code };
        if (!["android", "ios", "both"].includes(pricingAd.platform)) {
          throw createError("Invalid ad platform configuration.", 400);
        }

        const platforms = pricingAd.platform === "both" ? ["android", "ios"] : [pricingAd.platform];
        const pricingRows = [];
        for (const platform of platforms) {
          const cpmRule = await getApplicablePricingRule(connection, "cpm", pricingAd, platform);
          const cpcRule = await getApplicablePricingRule(connection, "cpc", pricingAd, platform);
          if (cpmRule.currency_code !== data.currency_code || cpcRule.currency_code !== data.currency_code) {
            throw createError(`CPM and CPC pricing currencies do not match for ${platform}.`, 400);
          }
          pricingRows.push({ platform, cpmRule, cpcRule });
        }

        // Close the previous pricing versions; historical analytics keep the
        // exact rates that applied to their complete event interval.
        await connection.execute(
          `UPDATE ad_campaign_pricing
           SET effective_until_timestamp = ?
           WHERE campaign_id = ? AND effective_until_timestamp IS NULL`,
          [now, campaignId],
        );

        for (const item of pricingRows) {
          await connection.execute(
            `INSERT INTO ad_campaign_pricing (
              campaign_id, ad_id, platform, cpm_pricing_rule_id,
              cpc_pricing_rule_id, currency_code, cpm_rate, cpc_rate,
              effective_from_timestamp, effective_until_timestamp, campaign_timezone, daily_budget,
              campaign_start_timestamp, campaign_end_timestamp, business_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
            [campaignId, adId, item.platform, item.cpmRule.id, item.cpcRule.id,
             data.currency_code, item.cpmRule.rate, item.cpcRule.rate, now, timezone,
             data.daily_budget, liveSchedule.startTimestamp, liveSchedule.endTimestamp, ad.business_id],
          );
        }

        const [liveCampaignUpdate] = await connection.execute(
          `UPDATE ad_campaigns
           SET business_id = ?, currency_code = ?, budget_type = 'daily',
               total_budget = ?, daily_budget = ?, duration_type = ?,
               duration_days = ?, start_date = ?, end_date = ?,
               start_timestamp = ?, end_timestamp = ?, timezone = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ? AND status = ? AND is_deleted = 0`,
          [ad.business_id, data.currency_code, data.total_budget, data.daily_budget,
           data.duration_type, data.duration_days, liveSchedule.startDate, liveSchedule.endDate,
           liveSchedule.startTimestamp, liveSchedule.endTimestamp, timezone,
           campaignId, userId, ad.status],
        );
        await connection.execute(
          `UPDATE ads
           SET last_completed_step = GREATEST(COALESCE(last_completed_step, 1), 3),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ? AND is_deleted = 0`,
          [adId, userId],
        );
      } else if (isScheduledEdit) {
        // A scheduled ad is still a draft. Apply its new budget, dates,
        // pricing snapshots and wallet commitment atomically.
        const [walletRows] = await connection.execute(
          `SELECT id FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
          [userId],
        );
        if (walletRows.length === 0) {
          throw createError("Wallet not found.", 404);
        }
        const wallet = walletRows[0];

        await connection.execute(
          `INSERT IGNORE INTO wallet_balances (wallet_id, currency_code, balance)
           VALUES (?, ?, 0.000000)`,
          [wallet.id, data.currency_code],
        );

        const [walletBalanceRows] = await connection.execute(
          `SELECT balance
           FROM wallet_balances
           WHERE wallet_id = ? AND currency_code = ?
           FOR UPDATE`,
          [wallet.id, data.currency_code],
        );
        if (walletBalanceRows.length === 0) {
          throw createError("Wallet currency balance not found.", 404);
        }

        const outstanding = await getWalletCommitmentSummary(
          connection,
          userId,
          nowTimestamp,
          data.currency_code,
          campaignId,
        );
        const campaignPayable = calculateWalletPayableMicros(
          decimalToMicros(data.total_budget),
        );
        const requiredWalletMicros =
          outstanding.committedPayableMicros + campaignPayable.payableMicros;
        const availableWalletMicros = decimalToMicros(walletBalanceRows[0].balance);

        if (availableWalletMicros < requiredWalletMicros) {
          const additionalRequiredMicros =
            requiredWalletMicros - availableWalletMicros;
          throw createError(
            "Insufficient wallet balance to update this scheduled campaign while maintaining the budgets of your other campaigns.",
            400,
            {
              available_balance: Number(microsToDecimal(availableWalletMicros)),
              existing_campaign_commitment: Number(outstanding.committedPayable),
              current_campaign_required: Number(
                microsToDecimal(campaignPayable.payableMicros),
              ),
              total_required: Number(microsToDecimal(requiredWalletMicros)),
              additional_amount_required: Number(
                microsToDecimal(additionalRequiredMicros),
              ),
              currency: data.currency_code,
            },
          );
        }

        const [pricingAdRows] = await connection.execute(
          `
            SELECT
              a.id,
              a.platform,
              a.objective_id,
              a.ad_type_id,
              a.ad_subtype_id,
              bd.country_code,
              bd.admin_area_1,
              bd.city,
              c.currency_code
            FROM ads a
            INNER JOIN ad_campaigns c
              ON c.id = a.campaign_id
              AND c.user_id = a.user_id
            INNER JOIN business_details bd
              ON bd.id = a.business_id
              AND bd.user_id = a.user_id
              AND bd.is_deleted = 0
            WHERE a.id = ?
              AND a.user_id = ?
              AND a.is_deleted = 0
            LIMIT 1
          `,
          [adId, userId],
        );

        if (pricingAdRows.length === 0) {
          throw createError("Ad pricing details could not be retrieved.", 404);
        }

        const pricingAd = pricingAdRows[0];
        pricingAd.currency_code = data.currency_code;

        if (!["android", "ios", "both"].includes(pricingAd.platform)) {
          throw createError("Invalid ad platform configuration.", 400);
        }

        const platforms =
          pricingAd.platform === "both"
            ? ["android", "ios"]
            : [pricingAd.platform];
        const newPricingRows = [];

        for (const platform of platforms) {
          const cpmRule = await getApplicablePricingRule(
            connection,
            "cpm",
            pricingAd,
            platform,
          );
          const cpcRule = await getApplicablePricingRule(
            connection,
            "cpc",
            pricingAd,
            platform,
          );

          if (
            cpmRule.currency_code !== cpcRule.currency_code ||
            cpmRule.currency_code !== data.currency_code
          ) {
            throw createError(
              `CPM and CPC pricing currencies do not match for ${platform}.`,
              400,
            );
          }

          newPricingRows.push({ platform, cpmRule, cpcRule });
        }

        const [campaignUpdate] = await connection.execute(
          `
            UPDATE ad_campaigns
            SET
              business_id = ?,
              currency_code = ?,
              budget_type = 'daily',
              total_budget = ?,
              daily_budget = ?,
              duration_type = ?,
              duration_days = ?,
              start_date = ?,
              end_date = ?,
              start_timestamp = ?,
              end_timestamp = ?,
              timezone = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND user_id = ?
              AND status = 'draft'
              AND is_deleted = 0
          `,
          [
            ad.business_id,
            data.currency_code,
            data.total_budget,
            data.daily_budget,
            data.duration_type,
            data.duration_days,
            schedule.startDate,
            schedule.endDate,
            schedule.startTimestamp,
            schedule.endTimestamp,
            timezone,
            schedule.campaignStatus,
            campaignId,
            userId,
          ],
        );

        if (campaignUpdate.affectedRows !== 1) {
          throw createError("Scheduled campaign could not be updated.", 409);
        }

        // This campaign has not started yet, so there are no delivered-event
        // records depending on these snapshots. Rebuild the snapshots using
        // the latest ad configuration and applicable pricing rules.
        await connection.execute(
          `DELETE FROM ad_campaign_pricing WHERE campaign_id = ?`,
          [campaignId],
        );

        for (const item of newPricingRows) {
          await connection.execute(
            `
              INSERT INTO ad_campaign_pricing (
                campaign_id,
                ad_id,
                platform,
                cpm_pricing_rule_id,
                cpc_pricing_rule_id,
                currency_code,
                cpm_rate,
                cpc_rate,
                campaign_timezone,
                daily_budget,
                campaign_start_timestamp,
                campaign_end_timestamp,
                business_id
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              campaignId,
              adId,
              item.platform,
              item.cpmRule.id,
              item.cpcRule.id,
              item.cpmRule.currency_code,
              item.cpmRule.rate,
              item.cpcRule.rate,
              timezone,
              data.daily_budget,
              schedule.startTimestamp,
              schedule.endTimestamp,
              ad.business_id,
            ],
          );
        }

        const adStatus = schedule.campaignStatus === "active" ? "active" : "draft";
        await connection.execute(
          `UPDATE ads
           SET status = ?,
               last_completed_step = GREATEST(COALESCE(last_completed_step, 1), 3),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ? AND is_deleted = 0`,
          [adStatus, adId, userId],
        );
      } else {
        const [updateResult] = await connection.execute(
          `
            UPDATE ad_campaigns
            SET
              business_id = ?,
              currency_code = ?,
              budget_type = 'daily',
              total_budget = ?,
              daily_budget = ?,
              duration_type = ?,
              duration_days = ?,
              start_date = ?,
              end_date = ?,
              timezone = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND user_id = ?
              AND status = 'draft'
              AND is_deleted = 0
          `,
          [
            ad.business_id,
            data.currency_code,
            data.total_budget,
            data.daily_budget,
            data.duration_type,
            data.duration_days,
            startDate,
            endDate,
            timezone,
            campaignId,
            userId,
          ],
        );

        if (updateResult.affectedRows !== 1) {
          throw createError("Draft campaign could not be updated.", 409);
        }

        await connection.execute(
          `UPDATE ads
           SET last_completed_step = GREATEST(COALESCE(last_completed_step, 1), 3),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ? AND status = 'draft' AND is_deleted = 0`,
          [adId, userId],
        );
      }
    } else {
      const [result] = await insertCampaignWithUniqueCode(
        connection,
        `
          INSERT INTO ad_campaigns (
            campaign_code,
            user_id,
            business_id,
            currency_code,
            budget_type,
            total_budget,
            daily_budget,
            duration_type,
            duration_days,
            start_date,
            end_date,
            timezone,
            status
          )
          VALUES (
            ?, ?, ?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, 'draft'
          )
        `,
        [
          userId,
          ad.business_id,
          data.currency_code,
          data.total_budget,
          data.daily_budget,
          data.duration_type,
          data.duration_days,
          startDate,
          endDate,
          timezone,
        ],
      );

      campaignId = result.insertId;

      const [updateAdResult] = await connection.execute(
        `
          UPDATE ads
          SET
            campaign_id = ?,
            last_completed_step = GREATEST(COALESCE(last_completed_step, 1), 3),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND user_id = ?
            AND status IN ('draft', 'active', 'paused')
            AND is_deleted = 0
        `,
        [campaignId, adId, userId],
      );

      if (updateAdResult.affectedRows !== 1) {
        throw createError("Draft ad could not be linked to campaign.", 409);
      }
    }

    const [rows] = await connection.execute(
      `
        SELECT
          id,
          campaign_code,
          user_id,
          business_id,
          currency_code,
          budget_type,
          total_budget,
          daily_budget,
          duration_type,
          duration_days,
          start_date,
          end_date,
          start_timestamp,
          end_timestamp,
          timezone,
          status,
          created_at,
          updated_at
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
          AND is_deleted = 0
        LIMIT 1
      `,
      [campaignId, userId],
    );

    if (rows.length === 0) {
      throw createError("Campaign could not be retrieved.", 404);
    }

    await connection.commit();

    return {
      ...rows[0],
      scheduled_edit_applied: isScheduledEdit,
      is_scheduled: rows[0].status === "draft" && isScheduledEdit,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getCampaignDetails = async (adId, userId) => {
  const [campaignRows] = await pool.execute(
    `
      SELECT
        a.id AS ad_id,
        a.campaign_id,
        a.status AS ad_status,
        a.last_completed_step,
        a.objective_id,
        a.ad_type_id,
        a.ad_subtype_id,
        a.platform AS ad_platform,
        c.id,
        c.campaign_code,
        c.user_id,
        c.business_id,
        c.currency_code,
        c.budget_type,
        c.total_budget,
        c.daily_budget,
        c.duration_type,
        c.duration_days,
        DATE_FORMAT(c.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(c.end_date, '%Y-%m-%d') AS end_date,
        c.start_timestamp,
        c.end_timestamp,
        c.timezone,
        c.status,
        c.created_at,
        c.updated_at
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.is_deleted = 0
        AND c.is_deleted = 0
      LIMIT 1
    `,
    [adId, userId],
  );

  if (campaignRows.length === 0) return null;

  const campaign = campaignRows[0];
  const [pricingRows] = await pool.execute(
    `
      SELECT
        platform,
        cpm_pricing_rule_id,
        cpc_pricing_rule_id,
        currency_code,
        cpm_rate,
        cpc_rate
      FROM ad_campaign_pricing
      WHERE campaign_id = ?
      ORDER BY platform DESC, id DESC
    `,
    [campaign.id],
  );

  return {
    ...campaign,
    pricing_snapshots: pricingRows,
  };
};

const getDraftCampaignForPublish = async (adId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id AS ad_id,
        a.campaign_id,
        a.status AS ad_status,
        c.id AS id,
        c.user_id,
        c.business_id,
        c.currency_code,
        c.duration_type,
        c.duration_days,
        DATE_FORMAT(c.start_date, '%Y-%m-%d') AS selected_start_date,
        DATE_FORMAT(c.end_date, '%Y-%m-%d') AS selected_end_date,
        c.start_timestamp,
        c.end_timestamp,
        c.timezone,
        c.status AS campaign_status
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.status IN ('draft', 'active', 'paused')
        AND a.moderation_status <> 'under_review'
        AND a.is_deleted = 0
        AND c.user_id = ?
        AND c.status IN ('draft', 'active', 'paused')
        AND c.status = a.status
        AND c.is_deleted = 0
        AND (
          a.status IN ('active', 'paused')
          OR NOT EXISTS (
            SELECT 1
            FROM ad_campaign_pricing p
            WHERE p.campaign_id = c.id
          )
          OR (
            c.start_timestamp > UNIX_TIMESTAMP()
            AND c.end_timestamp >= UNIX_TIMESTAMP()
            AND EXISTS (
              SELECT 1
              FROM ad_campaign_pricing p
              WHERE p.campaign_id = c.id
            )
          )
        )
      LIMIT 1
    `,
    [adId, userId, userId],
  );

  if (rows.length === 0) {
    throw createError("Editable campaign not found.", 404);
  }

  return rows[0];
};

const publishCampaign = async (
  adId,
  userId,
  { startDate, endDate, startTimestamp, endTimestamp, campaignStatus },
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [walletRows] = await connection.execute(
      `SELECT id FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    if (walletRows.length === 0) throw createError("Wallet not found.", 404);
    const wallet = walletRows[0];

    const [ads] = await connection.execute(
      `
        SELECT
          a.id,
          a.campaign_id,
          a.status,
          a.platform,
          a.objective_id,
          a.ad_type_id,
          a.ad_subtype_id,
          a.business_id,
          bd.country_code,
          bd.admin_area_1,
          bd.city,
          c.currency_code,
          c.timezone,
          c.daily_budget
        FROM ads a
        INNER JOIN ad_campaigns c
          ON c.id = a.campaign_id
          AND c.user_id = a.user_id
        INNER JOIN business_details bd
          ON bd.id = a.business_id
          AND bd.user_id = a.user_id
          AND bd.is_deleted = 0
        WHERE a.id = ?
          AND a.user_id = ?
          AND a.moderation_status <> 'under_review'
          AND a.is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (ads.length === 0 || !["draft", "active", "paused"].includes(ads[0].status)) {
      throw createError("Editable ad not found.", 404);
    }

    const ad = ads[0];
    const campaignId = ad.campaign_id;

    if (!campaignId) {
      throw createError("Campaign details have not been saved.", 400);
    }

    const [campaigns] = await connection.execute(
      `
        SELECT id, status, total_budget, currency_code, start_timestamp, end_timestamp
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
          AND is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [campaignId, userId],
    );

    if (campaigns.length === 0 || campaigns[0].status !== ad.status) {
      throw createError("Ad and campaign statuses do not match or campaign is not editable.", 409);
    }

    const currency = getCurrencyForCountry(ad.country_code);
    if (campaigns[0].currency_code !== currency.currency_code) {
      throw createError(
        "Campaign currency no longer matches the business country. Re-save the campaign before publishing.",
        409,
      );
    }

    await connection.execute(
      `INSERT IGNORE INTO wallet_balances (wallet_id, currency_code, balance) VALUES (?, ?, 0.000000)`,
      [wallet.id, currency.currency_code],
    );
    const [walletBalanceRows] = await connection.execute(
      `SELECT balance FROM wallet_balances WHERE wallet_id = ? AND currency_code = ? FOR UPDATE`,
      [wallet.id, currency.currency_code],
    );
    if (!walletBalanceRows.length) throw createError("Wallet currency balance not found.", 404);
    const walletBalance = walletBalanceRows[0].balance;

    const [existingPricing] = await connection.execute(
      `
        SELECT id
        FROM ad_campaign_pricing
        WHERE campaign_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [campaignId],
    );

    const nowTimestamp = Math.floor(Date.now() / 1000);

    const isPreviouslyPublished = ["active", "paused"].includes(ad.status);
    if (existingPricing.length > 0 && !isPreviouslyPublished) {
      const isFutureScheduledCampaign =
        campaigns[0].status === "draft" &&
        Number(campaigns[0].start_timestamp) > nowTimestamp &&
        Number(campaigns[0].end_timestamp) >= nowTimestamp;
      if (!isFutureScheduledCampaign) {
        throw createError(
          "Only a future scheduled draft campaign can be republished with existing pricing snapshots.",
          409,
        );
      }
      // Scheduled drafts have not delivered any impressions/clicks yet.
      await connection.execute(
        `DELETE FROM ad_campaign_pricing WHERE campaign_id = ?`,
        [campaignId],
      );
    }
    const outstanding = await getWalletCommitmentSummary(
      connection,
      userId,
      nowTimestamp,
      currency.currency_code,
      campaignId,
    );
    const campaignBudget = decimalToMicros(campaigns[0].total_budget);
    let campaignRemainingBudget = campaignBudget;
    if (isPreviouslyPublished) {
      const [spentRows] = await connection.execute(
        `SELECT COALESCE(SUM(total_charge), 0) AS spent
         FROM ad_campaign_daily_spend WHERE campaign_id = ?`,
        [campaignId],
      );
      const spentMicros = decimalToMicros(spentRows[0].spent || 0);
      if (campaignBudget < spentMicros) {
        throw createError("Campaign budget cannot be lower than the amount already spent.", 400);
      }
      campaignRemainingBudget = campaignBudget - spentMicros;
    }
    const campaignPayable = calculateWalletPayableMicros(campaignRemainingBudget);
    const requiredWalletMicros =
      outstanding.committedPayableMicros + campaignPayable.payableMicros;
    const availableWalletMicros = decimalToMicros(walletBalance);

    if (availableWalletMicros < requiredWalletMicros) {
      const additionalRequiredMicros =
        requiredWalletMicros - availableWalletMicros;

      throw createError(
        "Insufficient wallet balance to publish this campaign while maintaining the budgets of your other published campaigns.",
        400,
        {
          available_balance: Number(microsToDecimal(availableWalletMicros)),
          existing_campaign_commitment: Number(outstanding.committedPayable),
          current_campaign_required: Number(
            microsToDecimal(campaignPayable.payableMicros),
          ),
          total_required: Number(microsToDecimal(requiredWalletMicros)),
          additional_amount_required: Number(
            microsToDecimal(additionalRequiredMicros),
          ),
          currency: currency.currency_code,
        },
      );
    }

    if (!["android", "ios", "both"].includes(ad.platform)) {
      throw createError("Invalid ad platform configuration.", 400);
    }

    const platforms = ad.platform === "both" ? ["android", "ios"] : [ad.platform];

    if (!isPreviouslyPublished) {
    for (const platform of platforms) {
      const cpmRule = await getApplicablePricingRule(
        connection,
        "cpm",
        ad,
        platform,
      );
      const cpcRule = await getApplicablePricingRule(
        connection,
        "cpc",
        ad,
        platform,
      );

      if (cpmRule.currency_code !== cpcRule.currency_code) {
        throw createError(
          `CPM and CPC pricing currencies do not match for ${platform}.`,
          400,
        );
      }

      await connection.execute(
        `
          INSERT INTO ad_campaign_pricing (
            campaign_id,
            ad_id,
            platform,
            cpm_pricing_rule_id,
            cpc_pricing_rule_id,
            currency_code,
            cpm_rate,
            cpc_rate,
            campaign_timezone,
            daily_budget,
            campaign_start_timestamp,
            campaign_end_timestamp,
            business_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          campaignId,
          adId,
          platform,
          cpmRule.id,
          cpcRule.id,
          cpmRule.currency_code,
          cpmRule.rate,
          cpcRule.rate,
          ad.timezone,
          ad.daily_budget,
          startTimestamp,
          endTimestamp,
          ad.business_id,
        ],
      );
    }

    }

    const finalCampaignStatus = isPreviouslyPublished
      ? ad.status
      : campaignStatus;

    const [campaignUpdate] = await connection.execute(
      `
        UPDATE ad_campaigns
        SET
          start_date = ?,
          end_date = ?,
          start_timestamp = ?,
          end_timestamp = ?,
          currency_code = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status IN ('draft', 'active', 'paused')
          AND is_deleted = 0
      `,
      [
        startDate,
        endDate,
        startTimestamp,
        endTimestamp,
        currency.currency_code,
        finalCampaignStatus,
        campaignId,
        userId,
      ],
    );

    if (!isPreviouslyPublished) {
      const [adUpdate] = await connection.execute(
        `UPDATE ads
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND status = 'draft' AND is_deleted = 0`,
        [finalCampaignStatus, adId, userId],
      );
      if (adUpdate.affectedRows !== 1) {
        throw createError("Ad could not be published.", 409);
      }
    }

    const [rows] = await connection.execute(
      `
        SELECT
          id,
          campaign_code,
          user_id,
          business_id,
          currency_code,
          budget_type,
          total_budget,
          daily_budget,
          duration_type,
          duration_days,
          start_date,
          end_date,
          start_timestamp,
          end_timestamp,
          timezone,
          status,
          created_at,
          updated_at
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
          AND is_deleted = 0
        LIMIT 1
      `,
      [campaignId, userId],
    );

    if (rows.length === 0) {
      throw createError("Published campaign could not be retrieved.", 404);
    }

    await connection.commit();

    return {
      campaign: rows[0],
      ad_status: finalCampaignStatus,
      wallet_commitment: {
        available_balance: Number(microsToDecimal(availableWalletMicros)),
        existing_campaign_commitment: Number(outstanding.committedPayable),
        current_campaign_required: Number(
          microsToDecimal(campaignPayable.payableMicros),
        ),
        remaining_uncommitted_balance: Number(
          microsToDecimal(availableWalletMicros - requiredWalletMicros),
        ),
        currency: currency.currency_code,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getCompletedCampaignForRepublish = async (adId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id AS ad_id,
        a.campaign_id,
        a.status AS ad_status,
        a.moderation_status,
        a.platform,
        a.objective_id,
        a.ad_type_id,
        a.ad_subtype_id,
        a.business_id AS ad_business_id,
        bd.country_code,
        bd.admin_area_1,
        bd.city,
        c.id AS campaign_internal_id,
        c.campaign_code AS previous_campaign_code,
        c.business_id,
        c.currency_code,
        c.total_budget,
        c.daily_budget,
        c.duration_days,
        c.timezone,
        c.status AS campaign_status
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      INNER JOIN business_details bd
        ON bd.id = a.business_id
        AND bd.user_id = a.user_id
        AND bd.is_deleted = 0
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.status = 'completed'
        AND c.status = 'completed'
        AND a.is_deleted = 0
        AND c.is_deleted = 0
      LIMIT 1
    `,
    [adId, userId],
  );

  return rows[0] || null;
};

const republishCompletedCampaign = async (
  adId,
  userId,
  { durationDays, startDate, endDate, startTimestamp, endTimestamp, campaignStatus },
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [walletRows] = await connection.execute(
      `SELECT id FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    if (!walletRows.length) throw createError("Wallet not found.", 404);
    const wallet = walletRows[0];

    const [adRows] = await connection.execute(
      `
        SELECT
          a.id,
          a.campaign_id,
          a.status AS ad_status,
          a.moderation_status,
          a.platform,
          a.objective_id,
          a.ad_type_id,
          a.ad_subtype_id,
          a.business_id AS ad_business_id,
          bd.country_code,
          bd.admin_area_1,
          bd.city,
          c.id AS previous_campaign_id,
          c.campaign_code AS previous_campaign_code,
          c.currency_code AS previous_currency_code,
          c.total_budget,
          c.daily_budget,
          c.duration_days AS previous_duration_days,
          c.timezone
        FROM ads a
        INNER JOIN ad_campaigns c
          ON c.id = a.campaign_id
          AND c.user_id = a.user_id
        INNER JOIN business_details bd
          ON bd.id = a.business_id
          AND bd.user_id = a.user_id
          AND bd.is_deleted = 0
        WHERE a.id = ?
          AND a.user_id = ?
          AND a.status = 'completed'
          AND c.status = 'completed'
          AND a.is_deleted = 0
          AND c.is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (!adRows.length) {
      throw createError("Only completed advertisements can be republished.", 409);
    }

    const ad = adRows[0];
    if (ad.moderation_status !== "none") {
      throw createError(
        "This advertisement cannot be republished while it is blocked or under moderation.",
        409,
      );
    }

    if (Number(ad.previous_duration_days) !== Number(durationDays)) {
      throw createError("The saved campaign duration changed. Refresh and try again.", 409);
    }

    const currency = getCurrencyForCountry(ad.country_code);
    if (ad.previous_currency_code !== currency.currency_code) {
      throw createError(
        "The business country currency has changed. Update the campaign budget before republishing.",
        409,
      );
    }

    await connection.execute(
      `INSERT IGNORE INTO wallet_balances (wallet_id, currency_code, balance)
       VALUES (?, ?, 0.000000)`,
      [wallet.id, currency.currency_code],
    );

    const [walletBalanceRows] = await connection.execute(
      `SELECT balance FROM wallet_balances
       WHERE wallet_id = ? AND currency_code = ?
       FOR UPDATE`,
      [wallet.id, currency.currency_code],
    );
    if (!walletBalanceRows.length) {
      throw createError("Wallet currency balance not found.", 404);
    }

    const nowTimestamp = Math.floor(Date.now() / 1000);
    const outstanding = await getWalletCommitmentSummary(
      connection,
      userId,
      nowTimestamp,
      currency.currency_code,
    );
    const campaignPayable = calculateWalletPayableMicros(
      decimalToMicros(ad.total_budget),
    );
    const requiredWalletMicros =
      outstanding.committedPayableMicros + campaignPayable.payableMicros;
    const availableWalletMicros = decimalToMicros(walletBalanceRows[0].balance);

    if (availableWalletMicros < requiredWalletMicros) {
      throw createError(
        "Insufficient wallet balance to republish this campaign while maintaining the budgets of your other campaigns.",
        400,
        {
          available_balance: Number(microsToDecimal(availableWalletMicros)),
          existing_campaign_commitment: Number(outstanding.committedPayable),
          current_campaign_required: Number(microsToDecimal(campaignPayable.payableMicros)),
          total_required: Number(microsToDecimal(requiredWalletMicros)),
          additional_amount_required: Number(microsToDecimal(requiredWalletMicros - availableWalletMicros)),
          currency: currency.currency_code,
        },
      );
    }

    if (!["android", "ios", "both"].includes(ad.platform)) {
      throw createError("Invalid ad platform configuration.", 400);
    }

    const pricingAd = {
      objective_id: ad.objective_id,
      ad_type_id: ad.ad_type_id,
      ad_subtype_id: ad.ad_subtype_id,
      country_code: ad.country_code,
      admin_area_1: ad.admin_area_1,
      city: ad.city,
      currency_code: currency.currency_code,
    };
    const platforms = ad.platform === "both" ? ["android", "ios"] : [ad.platform];
    const pricingRows = [];

    for (const platform of platforms) {
      const cpmRule = await getApplicablePricingRule(connection, "cpm", pricingAd, platform);
      const cpcRule = await getApplicablePricingRule(connection, "cpc", pricingAd, platform);
      if (cpmRule.currency_code !== currency.currency_code || cpcRule.currency_code !== currency.currency_code) {
        throw createError(`CPM and CPC pricing currencies do not match for ${platform}.`, 400);
      }
      pricingRows.push({ platform, cpmRule, cpcRule });
    }

    const [campaignResult] = await insertCampaignWithUniqueCode(
      connection,
      `
        INSERT INTO ad_campaigns (
          campaign_code,
          user_id,
          business_id,
          currency_code,
          budget_type,
          total_budget,
          daily_budget,
          duration_type,
          duration_days,
          start_date,
          end_date,
          start_timestamp,
          end_timestamp,
          timezone,
          status
        )
        VALUES (?, ?, ?, ?, 'daily', ?, ?, 'days', ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        ad.ad_business_id,
        currency.currency_code,
        ad.total_budget,
        ad.daily_budget,
        durationDays,
        startDate,
        endDate,
        startTimestamp,
        endTimestamp,
        ad.timezone,
        campaignStatus,
      ],
    );

    const newCampaignId = campaignResult.insertId;

    for (const item of pricingRows) {
      await connection.execute(
        `
          INSERT INTO ad_campaign_pricing (
            campaign_id,
            ad_id,
            platform,
            cpm_pricing_rule_id,
            cpc_pricing_rule_id,
            currency_code,
            cpm_rate,
            cpc_rate,
            campaign_timezone,
            daily_budget,
            campaign_start_timestamp,
            campaign_end_timestamp,
            business_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          newCampaignId,
          adId,
          item.platform,
          item.cpmRule.id,
          item.cpcRule.id,
          currency.currency_code,
          item.cpmRule.rate,
          item.cpcRule.rate,
          ad.timezone,
          ad.daily_budget,
          startTimestamp,
          endTimestamp,
          ad.ad_business_id,
        ],
      );
    }

    const [adUpdate] = await connection.execute(
      `
        UPDATE ads
        SET campaign_id = ?,
            status = ?,
            last_completed_step = 3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'completed'
          AND is_deleted = 0
      `,
      [newCampaignId, campaignStatus, adId, userId],
    );
    if (adUpdate.affectedRows !== 1) {
      throw createError("Completed advertisement could not be republished.", 409);
    }

    const [campaignRows] = await connection.execute(
      `
        SELECT
          id,
          campaign_code,
          user_id,
          business_id,
          currency_code,
          budget_type,
          total_budget,
          daily_budget,
          duration_type,
          duration_days,
          start_date,
          end_date,
          start_timestamp,
          end_timestamp,
          timezone,
          status,
          created_at,
          updated_at
        FROM ad_campaigns
        WHERE id = ? AND user_id = ? AND is_deleted = 0
        LIMIT 1
      `,
      [newCampaignId, userId],
    );
    if (!campaignRows.length) {
      throw createError("Republished campaign could not be retrieved.", 404);
    }

    await connection.commit();

    return {
      campaign: campaignRows[0],
      previous_campaign_id: String(ad.previous_campaign_id),
      previous_campaign_code: ad.previous_campaign_code,
      ad_status: campaignStatus,
      wallet_commitment: {
        available_balance: Number(microsToDecimal(availableWalletMicros)),
        existing_campaign_commitment: Number(outstanding.committedPayable),
        current_campaign_required: Number(microsToDecimal(campaignPayable.payableMicros)),
        remaining_uncommitted_balance: Number(microsToDecimal(availableWalletMicros - requiredWalletMicros)),
        currency: currency.currency_code,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getCampaignEstimationData = async (adId, userId) => {
  const [rows] = await pool.execute(
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
        c.currency_code,
        m.media_type,
        c.total_budget,
        c.daily_budget,
        c.duration_days
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      INNER JOIN business_details bd
        ON bd.id = a.business_id
        AND bd.user_id = a.user_id
        AND bd.is_deleted = 0
      INNER JOIN ad_media m
        ON m.ad_id = a.id
        AND m.is_active = 1
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.is_deleted = 0
        AND c.is_deleted = 0
        AND c.status = 'draft'
      LIMIT 1
    `,
    [adId, userId],
  );

  return rows[0] ?? null;
};


const getCampaignPricingPreview = async (ad, currencyCode) => {
  const pricedAd = { ...ad, currency_code: currencyCode };
  const platforms = pricedAd.platform === "both" ? ["android", "ios"] : [pricedAd.platform];
  const result = {};
  for (const platform of platforms) {
    const cpm = await getApplicablePricingRule(pool, "cpm", pricedAd, platform);
    const cpc = await getApplicablePricingRule(pool, "cpc", pricedAd, platform);
    if (cpm.currency_code !== cpc.currency_code || cpm.currency_code !== currencyCode) {
      throw createError(`CPM and CPC pricing currencies do not match for ${platform}.`, 400);
    }
    result[platform] = { cpm_rate: cpm.rate, cpc_rate: cpc.rate, currency_code: currencyCode };
  }
  return result;
};

export {
  saveCampaign,
  getCampaignDetails,
  getDraftCampaignForPublish,
  publishCampaign,
  getCampaignEstimationData,
  getCampaignPricingPreview,
  getCompletedCampaignForRepublish,
  republishCompletedCampaign,
};
