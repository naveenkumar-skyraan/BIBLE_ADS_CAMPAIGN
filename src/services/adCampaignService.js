import * as model from "../models/adCampaignModel.js";
import { getWalletByUserId } from "../models/walletModel.js";
import * as adModel from "../models/adModel.js";
import estimateAdPerformance from "./adEstimationService.js";
import { getTarget } from "../models/adLocationModel.js";
import { DateTime } from "luxon";
import {
  decimalToMicros,
  microsToDecimal,
  calculatePercentageMicros,
  PLATFORM_FEE_PERCENT,
  GST_PERCENT,
} from "../utils/adSpendCalculator.js";
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

const calculatePaymentSummary = (dailyBudget, durationDays, savedTotalBudget = null) => {
  const dailyBudgetMicros = decimalToMicros(dailyBudget);
  const actualBudgetMicros = savedTotalBudget === null
    ? dailyBudgetMicros * BigInt(durationDays)
    : decimalToMicros(savedTotalBudget);
  const platformFeeMicros = calculatePercentageMicros(actualBudgetMicros, PLATFORM_FEE_PERCENT);
  const gstMicros = calculatePercentageMicros(actualBudgetMicros, GST_PERCENT);
  const payableMicros = actualBudgetMicros + platformFeeMicros + gstMicros;
  return {
    daily_budget: microsToDecimal(dailyBudgetMicros),
    duration_days: durationDays,
    actual_campaign_budget: microsToDecimal(actualBudgetMicros),
    platform_fee_percentage: PLATFORM_FEE_PERCENT,
    platform_fee: microsToDecimal(platformFeeMicros),
    gst_percentage: GST_PERCENT,
    gst_amount: microsToDecimal(gstMicros),
    total_payable: microsToDecimal(payableMicros),
    currency: null,
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
  const ad = await adModel.getAdEstimationInputs(adId, userId);
  if (!ad) throw createError("Ad details, business or active media not found.", 404);

  if (!Number.isFinite(MIN_DAILY_BUDGET) || MIN_DAILY_BUDGET <= 0) {
    throw new Error("MIN_DAILY_BUDGET must be a positive number.");
  }
  const currency = getCurrencyForCountry(ad.country_code);
  const dailyBudget = normalizeMoneyAmount(data.daily_budget, currency.currency_code, {
    min: MIN_DAILY_BUDGET,
  });
  const dailyBudgetMicros = decimalToMicros(dailyBudget);
  const wallet = await getWalletByUserId(userId, currency.currency_code);
  if (!wallet) throw createError("Wallet not found. Please add funds first.", 404);

  const availableBalanceMicros = decimalToMicros(wallet.balance || 0);
  const isPublishedEditableCampaign = ["active", "paused"].includes(ad.status);
  if (!isPublishedEditableCampaign && availableBalanceMicros < dailyBudgetMicros) {
    throw createError("Daily budget cannot exceed the available wallet balance.", 400, {
      currency: currency.currency_code,
      available_balance: microsToDecimal(availableBalanceMicros),
      minimum_daily_budget: MIN_DAILY_BUDGET,
    });
  }

  const target = await getTarget(adId, userId);
  if (!target) {
    throw createError("Please complete location targeting before configuring the campaign.", 400);
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

  const paymentSummary = calculatePaymentSummary(dailyBudget, durationDays);
  paymentSummary.currency = currency.currency_code;
  paymentSummary.currency_symbol = currency.currency_symbol;
  const requiredMicros = decimalToMicros(paymentSummary.total_payable);
  if (!isPublishedEditableCampaign && availableBalanceMicros < requiredMicros) {
    const additional = requiredMicros - availableBalanceMicros;
    throw createError("Insufficient wallet balance. Please add funds before continuing.", 400, {
      currency: currency.currency_code,
      available_balance: microsToDecimal(availableBalanceMicros),
      required_amount: paymentSummary.total_payable,
      additional_amount_required: microsToDecimal(additional),
      payment_summary: paymentSummary,
    });
  }

  // TEMPORARILY DISABLED: campaign estimation will be re-enabled later.
  // const estimation = await buildEstimation(ad, currency.currency_code, paymentSummary.actual_campaign_budget);
  const schedule = buildCampaignSchedule({
    duration_type: data.duration_type,
    duration_days: durationDays,
    start_date: startDate,
    end_date: endDate,
    timezone,
  });

  const campaign = await model.saveCampaign(adId, userId, {
    daily_budget: paymentSummary.daily_budget,
    total_budget: paymentSummary.actual_campaign_budget,
    currency_code: currency.currency_code,
    duration_type: data.duration_type,
    duration_days: durationDays,
    start_date: startDate,
    end_date: endDate,
    timezone,
  }, schedule);

  return {
    campaign,
    currency,
    payment_summary: paymentSummary,
    // estimation, // TEMPORARILY DISABLED; retain for future estimation support.
    wallet: {
      available_balance: microsToDecimal(availableBalanceMicros),
      currency: currency.currency_code,
      maximum_daily_budget: microsToDecimal(availableBalanceMicros),
      required_amount: paymentSummary.total_payable,
      additional_amount_required: "0.000000",
      sufficient_balance: true,
    },
  };
};

const getCampaignDetails = async (adId, userId) => {
  const campaign = await model.getCampaignDetails(adId, userId);
  if (!campaign) {
    throw createError("Campaign details not found for this ad.", 404);
  }

  const currency = getCurrencyMetadata(campaign.currency_code);
  const paymentSummary = calculatePaymentSummary(
    campaign.daily_budget,
    campaign.duration_days,
    campaign.total_budget,
  );
  paymentSummary.currency = currency.currency_code;
  paymentSummary.currency_symbol = currency.currency_symbol;

  // Return the current wallet balance for the campaign currency so the
  // Step 3 screen can show the same wallet context as the save response.
  const walletRecord = await getWalletByUserId(userId, currency.currency_code);
  const availableBalanceMicros = decimalToMicros(walletRecord?.balance ?? 0);
  const requiredAmountMicros = decimalToMicros(paymentSummary.total_payable);
  const additionalAmountMicros = requiredAmountMicros > availableBalanceMicros
    ? requiredAmountMicros - availableBalanceMicros
    : 0n;

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
    wallet: {
      available_balance: microsToDecimal(availableBalanceMicros),
      currency: currency.currency_code,
      maximum_daily_budget: microsToDecimal(availableBalanceMicros),
      required_amount: paymentSummary.total_payable,
      additional_amount_required: microsToDecimal(additionalAmountMicros),
      sufficient_balance: availableBalanceMicros >= requiredAmountMicros,
    },
  };
};

const republishCompletedAd = async (adId, userId) => {
  const completedCampaign = await model.getCompletedCampaignForRepublish(adId, userId);
  if (!completedCampaign) {
    throw createError("Only completed advertisements with a completed campaign can be republished.", 409);
  }
  if (completedCampaign.moderation_status !== "none") {
    throw createError("This advertisement cannot be republished while it is blocked or under moderation.", 409);
  }

  const timezone = validateTimezone(completedCampaign.timezone);
  const durationDays = Number(completedCampaign.duration_days);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) {
    throw createError("The completed campaign does not contain a valid duration for republishing.", 409);
  }

  // A republished campaign starts a fresh run immediately and keeps the
  // previous campaign's duration/budget. Its old campaign row and spend
  // history remain intact under the previous campaign ID.
  const schedule = buildCampaignSchedule({
    duration_type: "days",
    duration_days: durationDays,
    timezone,
  });

  const result = await model.republishCompletedCampaign(adId, userId, {
    durationDays,
    ...schedule,
  });

  return { ...result, timezone, timestamps_timezone: "UTC" };
};

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
  publishCampaign,
  republishCompletedAd,
  getCampaignEstimation,
};
