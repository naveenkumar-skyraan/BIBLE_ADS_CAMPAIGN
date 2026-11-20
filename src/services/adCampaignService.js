import * as model from "../models/adCampaignModel.js";
import * as adModel from "../models/adModel.js";
import estimateAdPerformance from "./adEstimationService.js";
import { getTarget } from "../models/adLocationModel.js";
import { DateTime } from "luxon";
import {
  decimalToMicros,
  microsToDecimal,
  microsToCurrencyDecimal,
  calculatePercentageMicros,
  PLATFORM_FEE_PERCENT,
  GST_PERCENT,
} from "../utils/adSpendCalculator.js";
import { calculateWalletPayableMicros } from "../utils/campaignWalletFunding.js";
import { getBusinessTaxConfiguration } from "../utils/taxConfig.js";
import {
  getCurrencyForCountry,
  getCurrencyMetadata,
  normalizeMoneyAmount,
} from "../utils/currencyConfig.js";

const MIN_DAILY_BUDGET = Number(process.env.MIN_DAILY_BUDGET || 100);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const createError = (message, statusCode, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const validateTimezone = (timezone) => {
  try {
    if (typeof timezone !== "string" || !timezone.trim()) throw new Error();
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    throw createError("Invalid campaign timezone.", 400);
  }
};

const getTodayDate = (timeZone) => DateTime.now().setZone(timeZone).toISODate();

const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError(`Invalid date: ${value}`, 400);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw createError(`Invalid date: ${value}`, 400);
  }
  return date;
};

const getDateDifference = (startDate, endDate) =>
  Math.floor((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / MILLISECONDS_PER_DAY);

const localDateTimeToUtc = (year, month, day, hour, minute, second, timeZone) => {
  const dateTime = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: timeZone },
  );
  if (!dateTime.isValid || dateTime.year !== year || dateTime.month !== month ||
      dateTime.day !== day || dateTime.hour !== hour || dateTime.minute !== minute ||
      dateTime.second !== second) {
    throw createError("The selected local time does not exist in the campaign timezone.", 400);
  }
  const offsets = dateTime.getPossibleOffsets();
  return offsets.reduce((earliest, candidate) =>
    candidate.toMillis() < earliest.toMillis() ? candidate : earliest,
  ).toUTC();
};

const localDateToUtc = (dateString, hour, minute, second, timeZone) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return localDateTimeToUtc(year, month, day, hour, minute, second, timeZone);
};

const calculateCustomDurationDays = (startDate, endDate, timeZone) => {
  const difference = getDateDifference(startDate, endDate);
  const today = getTodayDate(timeZone);
  if (startDate < today) throw createError("Start date cannot be in the past.", 400);
  if (difference < 0) throw createError("End date must be on or after start date.", 400);
  const durationDays = startDate === today ? difference : difference + 1;
  if (durationDays < 1) {
    throw createError("For a custom campaign starting today, select an end date after today.", 400);
  }
  return durationDays;
};


const buildCampaignSchedule = ({
  duration_type,
  duration_days,
  start_date,
  end_date,
  timezone,
}) => {
  const now = DateTime.now().setZone(timezone);
  const today = now.toISODate();

  if (duration_type === "days") {
    const durationDays = Number(duration_days);
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      throw createError("Invalid campaign duration.", 400);
    }

    const endLocalDate = now.startOf("day").plus({ days: durationDays });
    const end = localDateTimeToUtc(
      endLocalDate.year,
      endLocalDate.month,
      endLocalDate.day,
      now.hour,
      now.minute,
      now.second,
      timezone,
    );

    return {
      startDate: today,
      endDate: endLocalDate.toISODate(),
      startTimestamp: Math.floor(now.toUTC().toSeconds()),
      endTimestamp: Math.floor(end.toSeconds()),
      campaignStatus: "active",
    };
  }

  if (duration_type !== "custom_date") {
    throw createError("Invalid campaign duration type.", 400);
  }

  if (!start_date || !end_date) {
    throw createError("Custom campaign start and end dates are required.", 400);
  }

  parseDate(start_date);
  parseDate(end_date);

  if (start_date < today) {
    throw createError("Campaign start date cannot be in the past.", 400);
  }
  if (end_date < start_date) {
    throw createError("Campaign end date must be on or after its start date.", 400);
  }

  if (start_date === today) {
    if (getDateDifference(start_date, end_date) < 1) {
      throw createError(
        "For a custom campaign starting today, select an end date after today.",
        400,
      );
    }

    const end = localDateToUtc(
      end_date,
      now.hour,
      now.minute,
      now.second,
      timezone,
    );

    return {
      startDate: start_date,
      endDate: end_date,
      startTimestamp: Math.floor(now.toUTC().toSeconds()),
      endTimestamp: Math.floor(end.toSeconds()),
      campaignStatus: "active",
    };
  }

  const start = localDateToUtc(start_date, 0, 0, 0, timezone);
  const end = localDateToUtc(end_date, 23, 59, 59, timezone);

  return {
    startDate: start_date,
    endDate: end_date,
    startTimestamp: Math.floor(start.toSeconds()),
    endTimestamp: Math.floor(end.toSeconds()),
    campaignStatus: "draft",
  };
};

const calculatePaymentSummary = (dailyBudget, durationDays, savedTotalBudget = null, tax = null) => {
  const dailyBudgetMicros = decimalToMicros(dailyBudget);
  const actualBudgetMicros = savedTotalBudget === null
    ? dailyBudgetMicros * BigInt(durationDays)
    : decimalToMicros(savedTotalBudget);
  const platformFeePercent = Number(tax?.platform_fee_rate ?? PLATFORM_FEE_PERCENT);
  const taxPercent = Number(tax?.tax_rate ?? GST_PERCENT);
  const platformFeeMicros = calculatePercentageMicros(actualBudgetMicros, platformFeePercent);
  // Tax is assessed on base advertising spend only. Platform fee is excluded.
  const gstMicros = calculatePercentageMicros(actualBudgetMicros, taxPercent);
  const payableMicros = actualBudgetMicros + platformFeeMicros + gstMicros;
  return {
    daily_budget: microsToDecimal(dailyBudgetMicros),
    duration_days: durationDays,
    actual_campaign_budget: microsToDecimal(actualBudgetMicros),
    platform_fee_percentage: platformFeePercent,
    platform_fee: microsToDecimal(platformFeeMicros),
    tax_name: tax?.tax_name || "Tax",
    tax_percentage: taxPercent,
    tax_basis: "base_ad_spend",
    gst_percentage: taxPercent,
    gst_amount: microsToDecimal(gstMicros),
    tax_amount: microsToDecimal(gstMicros),
    total_payable: microsToDecimal(payableMicros),
    currency: null,
  };
};

const calculateWalletAvailability = async ({
  userId,
  ad,
  currency,
  paymentSummary,
  durationDays,
  taxConfiguration,
}) => {
  const context = await model.getCampaignBudgetQuoteWalletContext(
    userId,
    currency.currency_code,
    ad.campaign_id ?? null,
  );

  if (
    ["active", "paused"].includes(ad.status) &&
    context.current_campaign_currency &&
    context.current_campaign_currency !== currency.currency_code
  ) {
    throw createError(
      "The currency of a published campaign cannot be changed. Create a new campaign using the business's current country currency.",
      409,
    );
  }

  const walletBalanceMicros = decimalToMicros(context.wallet_balance);
  const existingCommitmentMicros = decimalToMicros(
    context.existing_campaign_commitment,
  );
  const availableAfterCommitmentsMicros =
    walletBalanceMicros - existingCommitmentMicros;
  const spentMicros = ["active", "paused"].includes(ad.status)
    ? decimalToMicros(context.current_campaign_spent)
    : 0n;
  const campaignBudgetMicros = decimalToMicros(
    paymentSummary.actual_campaign_budget,
  );
  const campaignBudgetValid = campaignBudgetMicros >= spentMicros;
  const remainingCampaignBudgetMicros = campaignBudgetValid
    ? campaignBudgetMicros - spentMicros
    : 0n;

  const currentCampaignPayable = calculateWalletPayableMicros(
    remainingCampaignBudgetMicros,
    taxConfiguration.platform_fee_rate,
    taxConfiguration.tax_rate,
  );
  const currentCampaignRequiredMicros = currentCampaignPayable.payableMicros;
  const totalRequiredMicros =
    existingCommitmentMicros + currentCampaignRequiredMicros;
  const additionalRequiredMicros = totalRequiredMicros > walletBalanceMicros
    ? totalRequiredMicros - walletBalanceMicros
    : 0n;
  const sufficientBalance =
    campaignBudgetValid && walletBalanceMicros >= totalRequiredMicros;

  // Calculate an affordable daily-budget ceiling after reserving the other
  // campaigns' remaining budgets, fees and taxes. Round down to the business
  // currency's minor unit so the value can never exceed the available wallet.
  const usableWalletMicros = availableAfterCommitmentsMicros > 0n
    ? availableAfterCommitmentsMicros
    : 0n;
  const feeBasisPoints = BigInt(
    Math.round(Number(taxConfiguration.platform_fee_rate) * 100),
  );
  const taxBasisPoints = BigInt(
    Math.round(Number(taxConfiguration.tax_rate) * 100),
  );
  const payableBasisPoints = 10000n + feeBasisPoints + taxBasisPoints;
  const affordableBaseBudgetMicros = payableBasisPoints > 0n
    ? (usableWalletMicros * 10000n) / payableBasisPoints + spentMicros
    : 0n;
  const hasValidDuration = Number.isInteger(Number(durationDays)) && Number(durationDays) > 0;
  const rawMaximumDailyBudgetMicros = hasValidDuration
    ? affordableBaseBudgetMicros / BigInt(durationDays)
    : 0n;
  const minorUnitScale = 10n ** BigInt(6 - currency.currency_decimal_places);
  const maximumDailyBudgetMicros =
    (rawMaximumDailyBudgetMicros / minorUnitScale) * minorUnitScale;

  const wallet = {
    available_balance: microsToDecimal(walletBalanceMicros),
    currency: currency.currency_code,
    existing_campaign_commitment: microsToDecimal(existingCommitmentMicros),
    existing_campaign_count: Number(context.existing_campaign_count || 0),
    available_after_commitments: microsToDecimal(
      availableAfterCommitmentsMicros,
    ),
    current_campaign_spent: microsToDecimal(spentMicros),
    current_campaign_remaining_budget: microsToDecimal(
      remainingCampaignBudgetMicros,
    ),
    current_campaign_required: microsToDecimal(
      currentCampaignRequiredMicros,
    ),
    campaign_required_amount: microsToDecimal(
      currentCampaignRequiredMicros,
    ),
    // Keep required_amount backward-compatible: it is this campaign's own
    // amount. total_required includes other campaigns' outstanding commitments.
    required_amount: microsToDecimal(currentCampaignRequiredMicros),
    total_required: microsToDecimal(totalRequiredMicros),
    additional_amount_required: microsToDecimal(additionalRequiredMicros),
    maximum_daily_budget: microsToCurrencyDecimal(
      maximumDailyBudgetMicros,
      currency.currency_decimal_places,
    ),
    sufficient_balance: sufficientBalance,
    can_continue: sufficientBalance,
  };

  return {
    wallet,
    validation: {
      is_valid_budget: campaignBudgetValid,
      code: !campaignBudgetValid
        ? "BUDGET_BELOW_AMOUNT_ALREADY_SPENT"
        : sufficientBalance
          ? "OK"
          : "INSUFFICIENT_WALLET_BALANCE",
      message: !campaignBudgetValid
        ? "The updated campaign budget cannot be lower than the amount already spent."
        : sufficientBalance
          ? null
          : "Insufficient wallet balance. Please add funds or reduce the campaign budget or duration.",
    },
  };
};

const buildCampaignBudgetQuote = async (adId, userId, data) => {
  const ad = await adModel.getAdEstimationInputs(adId, userId);
  if (!ad) {
    throw createError("Ad details, business or active media not found.", 404);
  }

  if (!Number.isFinite(MIN_DAILY_BUDGET) || MIN_DAILY_BUDGET <= 0) {
    throw new Error("MIN_DAILY_BUDGET must be a positive number.");
  }

  // Currency and tax are based on the selected business country, not the
  // campaign's target location.
  const currency = getCurrencyForCountry(ad.country_code);
  const dailyBudget = normalizeMoneyAmount(data.daily_budget, currency.currency_code, {
    min: MIN_DAILY_BUDGET,
  });

  const target = await getTarget(adId, userId);
  if (!target) {
    throw createError(
      "Please complete location targeting before configuring the campaign.",
      400,
    );
  }
  const timezone = validateTimezone(target.timezone);

  let durationDays;
  let startDate = null;
  let endDate = null;
  if (data.duration_type === "days") {
    durationDays = data.duration_days;
  } else {
    startDate = data.start_date;
    endDate = data.end_date;
    durationDays = calculateCustomDurationDays(startDate, endDate, timezone);
  }

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) {
    throw createError("Campaign duration must be between 1 and 3660 days.", 400);
  }

  const schedule = buildCampaignSchedule({
    duration_type: data.duration_type,
    duration_days: durationDays,
    start_date: startDate,
    end_date: endDate,
    timezone,
  });
  const taxConfiguration = await getBusinessTaxConfiguration(ad.business_id);
  const paymentSummary = calculatePaymentSummary(
    dailyBudget,
    durationDays,
    null,
    taxConfiguration,
  );
  paymentSummary.currency = currency.currency_code;
  paymentSummary.currency_code = currency.currency_code;
  paymentSummary.currency_symbol = currency.currency_symbol;

  const walletAvailability = await calculateWalletAvailability({
    userId,
    ad,
    currency,
    paymentSummary,
    durationDays,
    taxConfiguration,
  });

  return {
    currency,
    campaign: {
      ad_id: Number(adId),
      daily_budget: paymentSummary.daily_budget,
      duration_type: data.duration_type,
      duration_days: durationDays,
      start_date: schedule.startDate,
      end_date: schedule.endDate,
      start_timestamp: schedule.startTimestamp,
      end_timestamp: schedule.endTimestamp,
      campaign_status: schedule.campaignStatus,
      timezone,
    },
    payment_summary: paymentSummary,
    wallet: walletAvailability.wallet,
    validation: walletAvailability.validation,
  };
};

const buildEstimation = async (ad, currencyCode, budget) => {
  const pricing = await model.getCampaignPricingPreview(ad, currencyCode);
  const estimates = {};
  for (const [platform, rates] of Object.entries(pricing)) {
    estimates[platform] = estimateAdPerformance({
      objectiveId: ad.objective_id,
      adTypeId: ad.ad_type_id,
      mediaType: ad.media_type,
      totalBudget: budget,
      cpmRate: rates.cpm_rate,
      currency: currencyCode,
    });
  }
  const platforms = Object.keys(estimates);
  return {
    currency: currencyCode,
    pricing,
    platform_estimates: estimates,
    // Compatibility fields for clients previously expecting one estimate.
    ...estimates[platforms[0]],
  };
};

const saveCampaign = async (adId, userId, data) => {
  const quote = await buildCampaignBudgetQuote(adId, userId, data);
  if (!quote.validation.is_valid_budget) {
    throw createError(quote.validation.message, 400, {
      ...quote.wallet,
      payment_summary: quote.payment_summary,
      validation: quote.validation,
    });
  }
  if (!quote.wallet.sufficient_balance) {
    throw createError(quote.validation.message, 400, {
      ...quote.wallet,
      payment_summary: quote.payment_summary,
      validation: quote.validation,
    });
  }

  const campaign = await model.saveCampaign(adId, userId, {
    daily_budget: quote.payment_summary.daily_budget,
    total_budget: quote.payment_summary.actual_campaign_budget,
    currency_code: quote.currency.currency_code,
    duration_type: data.duration_type,
    duration_days: quote.campaign.duration_days,
    start_date: data.duration_type === "custom_date" ? data.start_date : null,
    end_date: data.duration_type === "custom_date" ? data.end_date : null,
    timezone: quote.campaign.timezone,
  }, {
    startDate: quote.campaign.start_date,
    endDate: quote.campaign.end_date,
    startTimestamp: quote.campaign.start_timestamp,
    endTimestamp: quote.campaign.end_timestamp,
    campaignStatus: quote.campaign.campaign_status,
  });

  return {
    campaign,
    currency: quote.currency,
    payment_summary: quote.payment_summary,
    wallet: quote.wallet,
  };
};

const getCampaignDetails = async (adId, userId) => {
  const campaign = await model.getCampaignDetails(adId, userId);
  if (!campaign) {
    throw createError("Campaign details not found for this ad.", 404);
  }

  const currency = getCurrencyMetadata(campaign.currency_code);
  const savedPricing = campaign.pricing_snapshots?.[0];
  const taxConfiguration = savedPricing ? {
    tax_name: savedPricing.tax_name,
    tax_rate: Number(savedPricing.tax_rate),
    platform_fee_rate: Number(savedPricing.platform_fee_rate),
    tax_basis: savedPricing.tax_basis,
  } : await getBusinessTaxConfiguration(campaign.business_id);
  const paymentSummary = calculatePaymentSummary(
    campaign.daily_budget,
    campaign.duration_days,
    campaign.total_budget,
    taxConfiguration,
  );
  paymentSummary.currency = currency.currency_code;
  paymentSummary.currency_symbol = currency.currency_symbol;

  // Match the Step 3 quote: account for other active, paused and scheduled
  // campaign commitments in the same global, currency-specific wallet.
  const walletAvailability = await calculateWalletAvailability({
    userId,
    ad: {
      status: campaign.ad_status,
      campaign_id: campaign.campaign_id,
    },
    currency,
    paymentSummary,
    durationDays: Number(campaign.duration_days),
    taxConfiguration,
  });

  const nowTimestamp = Math.floor(Date.now() / 1000);
  const isScheduled =
    campaign.status === "draft" &&
    campaign.start_timestamp !== null &&
    campaign.start_timestamp !== undefined &&
    Number(campaign.start_timestamp) > nowTimestamp &&
    campaign.end_timestamp !== null &&
    campaign.end_timestamp !== undefined &&
    Number(campaign.end_timestamp) >= nowTimestamp;

  return {
    campaign: {
      ...campaign,
      is_scheduled: isScheduled,
    },
    currency,
    payment_summary: paymentSummary,
    wallet: walletAvailability.wallet,
    validation: walletAvailability.validation,
  };
};

const republishCompletedAd = async (adId, userId) => {
  const result = await model.republishCompletedCampaign(adId, userId);
  return {
    ...result,
    timezone: result.campaign.timezone,
    timestamps_timezone: "UTC",
    resume_step: 1,
    next_step: 1,
  };
};

const getCampaignBudgetQuote = async (adId, userId, data) =>
  buildCampaignBudgetQuote(adId, userId, data);

const getCampaignEstimation = async (adId, userId) => {
  const campaign = await model.getCampaignEstimationData(adId, userId);
  if (!campaign) throw createError("Draft campaign not found.", 404);
  const currency = getCurrencyForCountry(campaign.country_code);
  return buildEstimation(campaign, currency.currency_code, campaign.total_budget);
};

const publishCampaign = async (adId, userId) => {
  const campaign = await model.getDraftCampaignForPublish(adId, userId);
  const timezone = validateTimezone(campaign.timezone);
  let schedule;

  if (["active", "paused"].includes(campaign.ad_status)) {
    // Re-saving an already published campaign must not rebuild its schedule
    // from past dates or change its active/paused state.
    schedule = {
      startDate: campaign.selected_start_date,
      endDate: campaign.selected_end_date,
      startTimestamp: Number(campaign.start_timestamp),
      endTimestamp: Number(campaign.end_timestamp),
      campaignStatus: campaign.campaign_status,
    };
  } else {
    schedule = buildCampaignSchedule({
      duration_type: campaign.duration_type,
      duration_days: campaign.duration_days,
      start_date: campaign.selected_start_date,
      end_date: campaign.selected_end_date,
      timezone,
    });
  }

  const result = await model.publishCampaign(adId, userId, schedule);
  return { ...result, timezone, timestamps_timezone: "UTC" };
};

export default {
  saveCampaign,
  getCampaignDetails,
  getCampaignBudgetQuote,
  publishCampaign,
  republishCompletedAd,
  getCampaignEstimation,
};
