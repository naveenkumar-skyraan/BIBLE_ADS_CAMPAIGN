
import pool from "../configs/database/db.js";
import {
  decimalToMicros,
  microsToDecimal,
} from "../utils/adSpendCalculator.js";
import { getCurrencyForCountry } from "../utils/currencyConfig.js";
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

const saveCampaign = async (adId, userId, data) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ads] = await connection.execute(
      `
        SELECT id, business_id, campaign_id
        FROM ads
        WHERE id = ?
          AND user_id = ?
          AND status IN ('draft', 'active', 'paused')
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

    if (campaignId) {
      const [campaigns] = await connection.execute(
        `
          SELECT id
          FROM ad_campaigns
          WHERE id = ?
            AND user_id = ?
            AND status = 'draft'
            AND is_deleted = 0
            AND NOT EXISTS (
              SELECT 1
              FROM ad_campaign_pricing p
              WHERE p.campaign_id = ad_campaigns.id
            )
          LIMIT 1
          FOR UPDATE
        `,
        [campaignId, userId],
      );

      if (campaigns.length === 0) {
        throw createError("Draft campaign not found.", 404);
      }

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
    } else {
      const [result] = await connection.execute(
        `
          INSERT INTO ad_campaigns (
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
            ?, ?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, 'draft'
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
      throw createError("Draft campaign not found.", 404);
    }

    await connection.commit();

    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
        c.timezone,
        c.status AS campaign_status
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.status = 'draft'
        AND a.is_deleted = 0
        AND c.user_id = ?
        AND c.status = 'draft'
        AND c.is_deleted = 0
        AND NOT EXISTS (
          SELECT 1
          FROM ad_campaign_pricing p
          WHERE p.campaign_id = c.id
        )
      LIMIT 1
    `,
    [adId, userId, userId],
  );

  if (rows.length === 0) {
    throw createError("Draft campaign not found.", 404);
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
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (ads.length === 0 || ads[0].status !== "draft") {
      throw createError("Draft ad not found or already published.", 404);
    }

    const ad = ads[0];
    const campaignId = ad.campaign_id;

    if (!campaignId) {
      throw createError("Campaign details have not been saved.", 400);
    }

    const [campaigns] = await connection.execute(
      `
        SELECT id, status, total_budget, currency_code
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
          AND is_deleted = 0
        LIMIT 1
        FOR UPDATE
      `,
      [campaignId, userId],
    );

    if (campaigns.length === 0 || campaigns[0].status !== "draft") {
      throw createError("Draft campaign not found or already published.", 400);
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

    if (existingPricing.length > 0) {
      throw createError("This campaign has already been scheduled or published.", 409);
    }

    const nowTimestamp = Math.floor(Date.now() / 1000);
    const outstanding = await getWalletCommitmentSummary(
      connection,
      userId,
      nowTimestamp,
      currency.currency_code,
      campaignId,
    );
    const campaignBudget = decimalToMicros(campaigns[0].total_budget);
    const campaignPayable = calculateWalletPayableMicros(campaignBudget);
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
            cpc_rate
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        ],
      );
    }

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
          AND status = 'draft'
          AND is_deleted = 0
      `,
      [
        startDate,
        endDate,
        startTimestamp,
        endTimestamp,
        currency.currency_code,
        campaignStatus,
        campaignId,
        userId,
      ],
    );

    if (campaignUpdate.affectedRows !== 1) {
      throw createError("Campaign could not be published.", 409);
    }

    if (campaignStatus === "active") {
      const [adUpdate] = await connection.execute(
        `
          UPDATE ads
          SET
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND user_id = ?
            AND status = 'draft'
            AND is_deleted = 0
        `,
        [adId, userId],
      );

      if (adUpdate.affectedRows !== 1) {
        throw createError("Ad could not be activated.", 409);
      }
    }

    const [rows] = await connection.execute(
      `
        SELECT
          id,
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
      ad_status: campaignStatus === "active" ? "active" : "draft",
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
  getDraftCampaignForPublish,
  publishCampaign,
  getCampaignEstimationData,
  getCampaignPricingPreview,
};
