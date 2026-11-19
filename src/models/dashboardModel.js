import pool from "../configs/database/db.js";
import { DateTime } from "luxon";
import { getCurrencyForCountry, getCurrencyMetadata } from "../utils/currencyConfig.js";
import { resolveBusinessTimezone } from "../utils/businessTimezone.js";

const PERIODS = new Set([
  "this_month",
  "this_year",
  "this_week",
  "last_month",
  "last_year",
]);

const dateRange = (period, timezone) => {
  const now = DateTime.now().setZone(timezone);
  if (!now.isValid) {
    const error = new Error("Invalid timezone.");
    error.statusCode = 400;
    throw error;
  }

  let start;
  let end;
  let previousStart;
  let previousEnd;

  switch (period) {
    case "this_year":
      start = now.startOf("year");
      end = now;
      previousStart = start.minus({ years: 1 });
      previousEnd = end.minus({ years: 1 });
      break;
    case "this_week":
      end = now.startOf("day");
      start = end.minus({ days: 6 });
      previousEnd = start.minus({ days: 1 });
      previousStart = previousEnd.minus({ days: 6 });
      break;
    case "last_month":
      start = now.minus({ months: 1 }).startOf("month");
      end = now.minus({ months: 1 }).endOf("month");
      previousStart = start.minus({ months: 1 }).startOf("month");
      previousEnd = start.minus({ days: 1 }).endOf("day");
      break;
    case "last_year":
      start = now.minus({ years: 1 }).startOf("year");
      end = now.minus({ years: 1 }).endOf("year");
      previousStart = start.minus({ years: 1 });
      previousEnd = end.minus({ years: 1 });
      break;
    case "this_month":
    default:
      start = now.startOf("month");
      end = now;
      previousStart = start.minus({ months: 1 }).startOf("month");
      previousEnd = start.minus({ days: 1 }).endOf("day");
      break;
  }

  return {
    start: start.toISODate(),
    end: end.toISODate(),
    previousStart: previousStart.toISODate(),
    previousEnd: previousEnd.toISODate(),
    days: Math.max(1, Math.round(end.startOf("day").diff(start.startOf("day"), "days").days) + 1),
  };
};

const percentChange = (current, previous) => {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (previousValue === 0) return currentValue === 0 ? 0 : null;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(2));
};

const numeric = (value) => Number(value || 0);
const money = (value) => Number(numeric(value).toFixed(6));

const currencyDetails = (code) => {
  try {
    const meta = getCurrencyMetadata(code);
    return {
      currency: meta.currency_code,
      currency_symbol: meta.currency_symbol,
      currency_name: meta.currency_name,
      currency_decimal_places: meta.currency_decimal_places,
    };
  } catch {
    return {
      currency: code || null,
      currency_symbol: code || null,
      currency_name: code || null,
      currency_decimal_places: 2,
    };
  }
};

const getBusinessContext = async (userId, requestedBusinessId) => {
  const [businesses] = await pool.execute(
    `
      SELECT id, name, business_name, country_code, admin_area_1, admin_area_2, city, area, postal_code, timezone, is_selected
      FROM business_details
      WHERE user_id = ?
        AND is_deleted = 0
      ORDER BY is_selected DESC, id DESC
    `,
    [userId],
  );

  if (businesses.length === 0) {
    const error = new Error("No business details found for this account.");
    error.statusCode = 404;
    throw error;
  }

  let business;
  if (requestedBusinessId) {
    business = businesses.find((item) => Number(item.id) === Number(requestedBusinessId));
    if (!business) {
      const error = new Error("Business not found or does not belong to the authenticated user.");
      error.statusCode = 404;
      throw error;
    }
  } else {
    business = businesses.find((item) => Number(item.is_selected) === 1) || businesses[0];
  }

  return { businesses, business };
};

const getSpendTotals = async (userId, businessId, start, end) => {
  const [rows] = await pool.execute(
    `
      SELECT
        currency_code,
        COALESCE(SUM(impressions), 0) AS impressions,
        COALESCE(SUM(clicks), 0) AS clicks,
        COALESCE(SUM(total_charge), 0) AS amount_spent,
        COALESCE(SUM(platform_fee), 0) AS platform_fee,
        COALESCE(SUM(gst_amount), 0) AS gst_amount,
        COALESCE(SUM(wallet_debit), 0) AS wallet_debit
      FROM ad_campaign_daily_spend
      WHERE user_id = ?
        AND business_id = ?
        AND campaign_local_date BETWEEN ? AND ?
      GROUP BY currency_code
      ORDER BY currency_code
    `,
    [userId, businessId, start, end],
  );

  return rows.map((row) => ({
    ...currencyDetails(row.currency_code),
    impressions: numeric(row.impressions),
    clicks: numeric(row.clicks),
    amount_spent: money(row.amount_spent),
    platform_fee: money(row.platform_fee),
    gst_amount: money(row.gst_amount),
    wallet_debit: money(row.wallet_debit),
  }));
};

const singleCurrencyTotal = (rows, field, currencies) =>
  currencies.length <= 1
    ? money(rows.reduce((sum, row) => sum + numeric(row[field]), 0))
    : null;

const getDashboardOverview = async ({
  userId,
  businessId,
  overviewPeriod = "this_month",
  spendPeriod = "this_year",
  topLimit = 5,
}) => {
  if (!PERIODS.has(overviewPeriod) || !PERIODS.has(spendPeriod)) {
    const error = new Error("Invalid dashboard period.");
    error.statusCode = 400;
    throw error;
  }

  const { businesses, business } = await getBusinessContext(userId, businessId);

  // Resolve once and persist for existing businesses that predate this column.
  let businessTimezone = business.timezone;
  if (!businessTimezone) {
    businessTimezone = await resolveBusinessTimezone(business);
    if (!businessTimezone) {
      const error = new Error(
        "Business timezone could not be determined. Please update the business location details.",
      );
      error.statusCode = 422;
      throw error;
    }

    await pool.execute(
      `UPDATE business_details
       SET timezone = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND is_deleted = 0`,
      [businessTimezone, business.id, userId],
    );
  }

  const overviewRange = dateRange(overviewPeriod, businessTimezone);
  const spendRange = dateRange(spendPeriod, businessTimezone);

  const [overviewTotals, previousTotals, campaignRows, spendRows, topCampaignRows] = await Promise.all([
    getSpendTotals(userId, business.id, overviewRange.start, overviewRange.end),
    getSpendTotals(userId, business.id, overviewRange.previousStart, overviewRange.previousEnd),
    pool.execute(
      `
        SELECT
          COUNT(*) AS total_campaigns,
          SUM(CASE WHEN a.moderation_status = 'under_review' THEN 1 ELSE 0 END) AS under_verify,
          SUM(CASE WHEN a.moderation_status <> 'under_review' AND c.status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN a.moderation_status <> 'under_review' AND c.status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN a.moderation_status <> 'under_review' AND c.status = 'paused' THEN 1 ELSE 0 END) AS paused,
          SUM(CASE WHEN a.moderation_status <> 'under_review' AND c.status = 'draft' THEN 1 ELSE 0 END) AS draft
        FROM ad_campaigns c
        INNER JOIN ads a
          ON a.campaign_id = c.id
          AND a.user_id = c.user_id
        WHERE c.user_id = ?
          AND c.business_id = ?
          AND c.is_deleted = 0
          AND a.is_deleted = 0
      `,
      [userId, business.id],
    ),
    pool.execute(
      `
        SELECT
          DATE_FORMAT(campaign_local_date, '%Y-%m-%d') AS campaign_local_date,
          currency_code,
          COALESCE(SUM(total_charge), 0) AS amount_spent,
          COALESCE(SUM(platform_fee), 0) AS platform_fee,
          COALESCE(SUM(gst_amount), 0) AS gst_amount,
          COALESCE(SUM(wallet_debit), 0) AS wallet_debit,
          COALESCE(SUM(impressions), 0) AS impressions,
          COALESCE(SUM(clicks), 0) AS clicks
        FROM ad_campaign_daily_spend
        WHERE user_id = ?
          AND business_id = ?
          AND campaign_local_date BETWEEN ? AND ?
        GROUP BY campaign_local_date, currency_code
        ORDER BY campaign_local_date ASC, currency_code ASC
      `,
      [userId, business.id, spendRange.start, spendRange.end],
    ),
    pool.execute(
      `
        SELECT
          c.id AS campaign_id,
          a.id AS ad_id,
          a.title,
          a.description,
          a.status AS ad_status,
          a.moderation_status,
          a.objective_id,
          o.name AS objective_name,
          c.currency_code,
          (
            SELECT media.file_url
            FROM ad_media media
            WHERE media.ad_id = a.id
              AND media.is_active = 1
              AND media.media_type = 'image'
            ORDER BY media.sort_order ASC, media.id ASC
            LIMIT 1
          ) AS image_url,
          COALESCE(SUM(ds.impressions), 0) AS impressions,
          COALESCE(SUM(ds.clicks), 0) AS clicks,
          COALESCE(SUM(ds.total_charge), 0) AS amount_spent,
          COALESCE(SUM(ds.platform_fee), 0) AS platform_fee,
          COALESCE(SUM(ds.gst_amount), 0) AS gst_amount,
          COALESCE(SUM(ds.wallet_debit), 0) AS wallet_debit
        FROM ad_campaigns c
        INNER JOIN ads a
          ON a.campaign_id = c.id
          AND a.user_id = c.user_id
        LEFT JOIN ad_objectives o
          ON o.id = a.objective_id
        LEFT JOIN ad_campaign_daily_spend ds
          ON ds.campaign_id = c.id
          AND ds.ad_id = a.id
          AND ds.user_id = c.user_id
          AND ds.business_id = c.business_id
          AND ds.currency_code = c.currency_code
          AND ds.campaign_local_date BETWEEN ? AND ?
        WHERE c.user_id = ?
          AND c.business_id = ?
          AND c.is_deleted = 0
          AND a.is_deleted = 0
        GROUP BY
          c.id, a.id, a.title, a.description, a.status,
          a.moderation_status, a.objective_id, o.name, c.currency_code
        HAVING
          SUM(COALESCE(ds.impressions, 0)) > 0
          OR SUM(COALESCE(ds.clicks, 0)) > 0
          OR SUM(COALESCE(ds.total_charge, 0)) > 0
        ORDER BY impressions DESC, clicks DESC, amount_spent DESC, c.id DESC
        LIMIT ?
      `,
      [overviewRange.start, overviewRange.end, userId, business.id, topLimit],
    ),
  ]);

  const overview = overviewTotals;
  const previous = previousTotals;
  const currentImpressions = overview.reduce((sum, row) => sum + row.impressions, 0);
  const currentClicks = overview.reduce((sum, row) => sum + row.clicks, 0);
  const previousImpressions = previous.reduce((sum, row) => sum + row.impressions, 0);
  const previousClicks = previous.reduce((sum, row) => sum + row.clicks, 0);
  const currencies = [...new Set(overview.map((row) => row.currency))].sort();
  const previousCurrencies = [...new Set(previous.map((row) => row.currency))].sort();

  const amountSpent = singleCurrencyTotal(overview, "amount_spent", currencies);
  const platformFee = singleCurrencyTotal(overview, "platform_fee", currencies);
  const gstAmount = singleCurrencyTotal(overview, "gst_amount", currencies);
  const walletDebit = singleCurrencyTotal(overview, "wallet_debit", currencies);
  const previousAmountSpent = singleCurrencyTotal(previous, "amount_spent", previousCurrencies);
  const previousWalletDebit = singleCurrencyTotal(previous, "wallet_debit", previousCurrencies);

  const [campaignCountRows] = campaignRows;
  const campaignCount = campaignCountRows[0] || {
    total_campaigns: 0, active: 0, completed: 0, paused: 0, draft: 0, under_verify: 0,
  };
  const [dailyRows] = spendRows;
  const [topRows] = topCampaignRows;

  const bucketByMonth = spendPeriod === "this_year" || spendPeriod === "last_year";
  const chartMap = new Map();
  for (const row of dailyRows) {
    const key = bucketByMonth
      ? String(row.campaign_local_date).slice(0, 7)
      : String(row.campaign_local_date).slice(0, 10);
    const mapKey = `${key}:${row.currency_code}`;
    const existing = chartMap.get(mapKey) || {
      period: key,
      ...currencyDetails(row.currency_code),
      amount_spent: 0,
      platform_fee: 0,
      gst_amount: 0,
      wallet_debit: 0,
      impressions: 0,
      clicks: 0,
    };
    existing.amount_spent += numeric(row.amount_spent);
    existing.platform_fee += numeric(row.platform_fee);
    existing.gst_amount += numeric(row.gst_amount);
    existing.wallet_debit += numeric(row.wallet_debit);
    existing.impressions += numeric(row.impressions);
    existing.clicks += numeric(row.clicks);
    chartMap.set(mapKey, existing);
  }

  const spendCurrencies = [...new Set(dailyRows.map((row) => row.currency_code))].sort();
  const chartCurrencies = spendCurrencies.length ? spendCurrencies : currencies;
  const chartStart = DateTime.fromISO(spendRange.start, { zone: businessTimezone });
  const chartEnd = DateTime.fromISO(spendRange.end, { zone: businessTimezone });
  const chartData = [];

  for (
    let cursor = chartStart;
    cursor <= chartEnd;
    cursor = bucketByMonth ? cursor.plus({ months: 1 }).startOf("month") : cursor.plus({ days: 1 })
  ) {
    const key = bucketByMonth ? cursor.toFormat("yyyy-MM") : cursor.toISODate();
    for (const currency of chartCurrencies) {
      const row = chartMap.get(`${key}:${currency}`);
      chartData.push({
        period: key,
        ...currencyDetails(currency),
        amount_spent: money(row?.amount_spent),
        platform_fee: money(row?.platform_fee),
        gst_amount: money(row?.gst_amount),
        wallet_debit: money(row?.wallet_debit),
        impressions: row?.impressions || 0,
        clicks: row?.clicks || 0,
      });
    }
  }

  const spendCurrencyTotals = spendCurrencies.map((currency) => {
    const rows = dailyRows.filter((row) => row.currency_code === currency);
    return {
      ...currencyDetails(currency),
      amount_spent: money(rows.reduce((sum, row) => sum + numeric(row.amount_spent), 0)),
      platform_fee: money(rows.reduce((sum, row) => sum + numeric(row.platform_fee), 0)),
      gst_amount: money(rows.reduce((sum, row) => sum + numeric(row.gst_amount), 0)),
      wallet_debit: money(rows.reduce((sum, row) => sum + numeric(row.wallet_debit), 0)),
      impressions: rows.reduce((sum, row) => sum + numeric(row.impressions), 0),
      clicks: rows.reduce((sum, row) => sum + numeric(row.clicks), 0),
    };
  });

  const businessCurrency = getCurrencyForCountry(business.country_code);
  const campaignPerformance = {
    total_campaigns: numeric(campaignCount.total_campaigns),
    active: numeric(campaignCount.active),
    completed: numeric(campaignCount.completed),
    paused: numeric(campaignCount.paused),
    draft: numeric(campaignCount.draft),
    under_verify: numeric(campaignCount.under_verify),
  };

  return {
    businesses: businesses.map(({ id, name, business_name, country_code, admin_area_1, city, area, timezone: savedTimezone, is_selected }) => {
      const businessCurrencyDetails = getCurrencyForCountry(country_code);
      return {
        id: Number(id),
        name,
        business_name,
        country_code,
        admin_area_1,
        city,
        area,
        timezone: Number(id) === Number(business.id) ? businessTimezone : savedTimezone || null,
        is_selected: Boolean(Number(is_selected)),
        currency: businessCurrencyDetails,
      };
    }),
    selected_business: {
      id: Number(business.id),
      name: business.name,
      business_name: business.business_name,
      country_code: business.country_code,
      admin_area_1: business.admin_area_1,
      city: business.city,
      area: business.area,
      currency: businessCurrency,
      timezone: businessTimezone,
    },
    filters: {
      overview_period: overviewPeriod,
      spend_period: spendPeriod,
      timezone: businessTimezone,
      overview: overviewRange,
      spend: spendRange,
    },
    quick_overview: {
      total_impressions: currentImpressions,
      total_clicks: currentClicks,
      total_amount_spent: amountSpent,
      total_platform_fee: platformFee,
      total_gst_amount: gstAmount,
      total_wallet_debit: walletDebit,
      currency: currencies.length === 1 ? currencies[0] : null,
      currency_symbol: currencies.length === 1 ? currencyDetails(currencies[0]).currency_symbol : null,
      currency_totals: overview,
      comparison: {
        impressions_percent: percentChange(currentImpressions, previousImpressions),
        clicks_percent: percentChange(currentClicks, previousClicks),
        amount_spent_percent:
          amountSpent !== null && previousAmountSpent !== null &&
          currencies.join(",") === previousCurrencies.join(",")
            ? percentChange(amountSpent, previousAmountSpent)
            : null,
        wallet_debit_percent:
          walletDebit !== null && previousWalletDebit !== null &&
          currencies.join(",") === previousCurrencies.join(",")
            ? percentChange(walletDebit, previousWalletDebit)
            : null,
        previous_period: {
          start_date: overviewRange.previousStart,
          end_date: overviewRange.previousEnd,
          total_impressions: previousImpressions,
          total_clicks: previousClicks,
          total_amount_spent: previousAmountSpent,
          total_wallet_debit: previousWalletDebit,
          currency: previousCurrencies.length === 1 ? previousCurrencies[0] : null,
          currency_totals: previous,
        },
      },
    },
    campaign_performance: campaignPerformance,
    spend_overview: {
      total_amount_spent: singleCurrencyTotal(spendCurrencyTotals, "amount_spent", spendCurrencies),
      total_platform_fee: singleCurrencyTotal(spendCurrencyTotals, "platform_fee", spendCurrencies),
      total_gst_amount: singleCurrencyTotal(spendCurrencyTotals, "gst_amount", spendCurrencies),
      total_wallet_debit: singleCurrencyTotal(spendCurrencyTotals, "wallet_debit", spendCurrencies),
      currency: spendCurrencies.length === 1 ? spendCurrencies[0] : null,
      currency_symbol: spendCurrencies.length === 1 ? currencyDetails(spendCurrencies[0]).currency_symbol : null,
      currency_totals: spendCurrencyTotals,
      bucket: bucketByMonth ? "month" : "day",
      chart_data: chartData,
    },
    top_performing_campaigns: topRows.map((row) => ({
      campaign_id: Number(row.campaign_id),
      ad_id: Number(row.ad_id),
      title: row.title,
      description: row.description,
      image_url: row.image_url,
      objective_id: Number(row.objective_id),
      objective_name: row.objective_name,
      status: row.ad_status,
      moderation_status: row.moderation_status,
      impressions: numeric(row.impressions),
      clicks: numeric(row.clicks),
      amount_spent: money(row.amount_spent),
      platform_fee: money(row.platform_fee),
      gst_amount: money(row.gst_amount),
      wallet_debit: money(row.wallet_debit),
      ...currencyDetails(row.currency_code),
    })),
  };
};

export default { getDashboardOverview };
