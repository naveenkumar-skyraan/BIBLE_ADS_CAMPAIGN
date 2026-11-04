
import * as model from "../models/adCampaignModel.js";
import { getWalletByUserId } from "../models/walletModel.js";

const MIN_DAILY_BUDGET = 100;
const PLATFORM_FEE_PERCENT = 30;
const GST_PERCENT = 18;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CAMPAIGN_TIMEZONE = "Asia/Kolkata";

const createError = (message, statusCode, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
};

const toPaise = (amount) => Math.round(Number(amount) * 100);

const toRupees = (paise) => Number((paise / 100).toFixed(2));

const getDateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
};

const getTodayDate = (timeZone) => {
  const parts = getDateParts(new Date(), timeZone);

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const parseDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw createError(`Invalid date: ${value}`, 400);
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createError(`Invalid date: ${value}`, 400);
  }

  return date;
};

const getDateDifference = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  return Math.floor(
    (end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY,
  );
};

const localDateTimeToUtc = (
  year,
  month,
  day,
  hour,
  minute,
  second,
  timeZone,
) => {
  const targetUtcValue = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  );

  let candidate = targetUtcValue;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getDateParts(new Date(candidate), timeZone);

    const representedUtcValue = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );

    const difference = targetUtcValue - representedUtcValue;

    if (difference === 0) {
      break;
    }

    candidate += difference;
  }

  return new Date(candidate);
};

const localDateToUtc = (
  dateString,
  hour,
  minute,
  second,
  timeZone,
) => {
  const [year, month, day] = dateString.split("-").map(Number);

  return localDateTimeToUtc(
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeZone,
  );
};

const toMysqlUtcDateTime = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
};

const calculateCustomDurationDays = (
  startDate,
  endDate,
  timeZone,
) => {
  const difference = getDateDifference(startDate, endDate);

  if (startDate < getTodayDate(timeZone)) {
    throw createError("Start date cannot be in the past.", 400);
  }

  if (difference < 0) {
    throw createError("End date must be on or after start date.", 400);
  }

  const durationDays =
    startDate === getTodayDate(timeZone)
      ? difference
      : difference + 1;

  if (durationDays < 1) {
    throw createError(
      "For a custom campaign starting today, select an end date after today.",
      400,
    );
  }

  return durationDays;
};

const calculatePaymentSummary = (dailyBudget, durationDays) => {
  const dailyBudgetPaise = toPaise(dailyBudget);

  const actualBudgetPaise = dailyBudgetPaise * durationDays;

  const platformFeePaise = Math.round(
    (actualBudgetPaise * PLATFORM_FEE_PERCENT) / 100,
  );

  const gstPaise = Math.round(
    (actualBudgetPaise * GST_PERCENT) / 100,
  );

  const totalPayablePaise =
    actualBudgetPaise + platformFeePaise + gstPaise;

  return {
    daily_budget: toRupees(dailyBudgetPaise),
    duration_days: durationDays,
    actual_campaign_budget: toRupees(actualBudgetPaise),
    platform_fee_percentage: PLATFORM_FEE_PERCENT,
    platform_fee: toRupees(platformFeePaise),
    gst_percentage: GST_PERCENT,
    gst_amount: toRupees(gstPaise),
    total_payable: toRupees(totalPayablePaise),
  };
};

const saveCampaign = async (adId, userId, data) => {
  const wallet = await getWalletByUserId(userId);

  if (!wallet) {
    throw createError("Wallet not found.", 404);
  }

  const availableBalance = Number(wallet.balance || 0);
  const availableBalancePaise = toPaise(availableBalance);

  if (
    !Number.isFinite(availableBalance) ||
    availableBalance < MIN_DAILY_BUDGET
  ) {
    throw createError(
      "Insufficient wallet balance. Please add funds.",
      400,
      {
        available_balance: availableBalance,
        minimum_daily_budget: MIN_DAILY_BUDGET,
      },
    );
  }

  const dailyBudget = Number(data.daily_budget);
  const dailyBudgetPaise = toPaise(dailyBudget);

  if (
    !Number.isFinite(dailyBudget) ||
    dailyBudgetPaise < toPaise(MIN_DAILY_BUDGET) ||
    dailyBudgetPaise > availableBalancePaise
  ) {
    throw createError(
      "Daily budget must be between ₹100 and your available wallet balance.",
      400,
      {
        minimum_daily_budget: MIN_DAILY_BUDGET,
        maximum_daily_budget: availableBalance,
        available_balance: availableBalance,
      },
    );
  }

  const timezone = DEFAULT_CAMPAIGN_TIMEZONE;

  let durationDays;
  let startDate = null;
  let endDate = null;

  if (data.duration_type === "days") {
    durationDays = data.duration_days;
  } else {
    startDate = data.start_date;
    endDate = data.end_date;

    durationDays = calculateCustomDurationDays(
      startDate,
      endDate,
      timezone,
    );
  }

  const paymentSummary = calculatePaymentSummary(
    dailyBudget,
    durationDays,
  );

  const requiredAmountPaise = toPaise(
    paymentSummary.total_payable,
  );

  if (availableBalancePaise < requiredAmountPaise) {
    throw createError(
      "Insufficient wallet balance. Please add funds before continuing.",
      400,
      {
        available_balance: availableBalance,
        required_amount: paymentSummary.total_payable,
        additional_amount_required: toRupees(
          requiredAmountPaise - availableBalancePaise,
        ),
        payment_summary: paymentSummary,
      },
    );
  }

  const campaign = await model.saveCampaign(adId, userId, {
    daily_budget: paymentSummary.daily_budget,
    total_budget: paymentSummary.actual_campaign_budget,
    duration_type: data.duration_type,
    duration_days: durationDays,
    start_date: startDate,
    end_date: endDate,
    timezone,
  });

  return {
    campaign,
    payment_summary: paymentSummary,
    wallet: {
      available_balance: availableBalance,
      maximum_daily_budget: availableBalance,
      required_amount: paymentSummary.total_payable,
      additional_amount_required: 0,
      sufficient_balance: true,
    },
  };
};

const publishCampaign = async (adId, userId) => {
  const campaign = await model.getDraftCampaignForPublish(
    adId,
    userId,
  );

  const timezone =
    campaign.timezone || DEFAULT_CAMPAIGN_TIMEZONE;

  const now = new Date();
  const nowParts = getDateParts(now, timezone);

  const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;

  let startDateTime;
  let endDateTime;
  let campaignStatus;

  if (campaign.duration_type === "days") {
    const durationDays = Number(campaign.duration_days);

    if (!Number.isInteger(durationDays) || durationDays < 1) {
      throw createError("Invalid campaign duration.", 400);
    }

    const start = now;

    const end = new Date(
      start.getTime() + durationDays * MILLISECONDS_PER_DAY,
    );

    startDateTime = toMysqlUtcDateTime(start);
    endDateTime = toMysqlUtcDateTime(end);

    campaignStatus = "active";
  } else if (campaign.duration_type === "custom_date") {
    const selectedStartDate = campaign.selected_start_date;
    const selectedEndDate = campaign.selected_end_date;

    if (!selectedStartDate || !selectedEndDate) {
      throw createError(
        "Custom campaign start and end dates are required.",
        400,
      );
    }

    parseDate(selectedStartDate);
    parseDate(selectedEndDate);

    if (selectedStartDate < today) {
      throw createError("Campaign start date cannot be in the past.", 400);
    }

    if (selectedEndDate < selectedStartDate) {
      throw createError(
        "Campaign end date must be on or after its start date.",
        400,
      );
    }

    if (selectedStartDate === today) {
      const difference = getDateDifference(
        selectedStartDate,
        selectedEndDate,
      );

      if (difference < 1) {
        throw createError(
          "For a custom campaign starting today, select an end date after today.",
          400,
        );
      }

      const start = now;

      const end = localDateToUtc(
        selectedEndDate,
        Number(nowParts.hour),
        Number(nowParts.minute),
        Number(nowParts.second),
        timezone,
      );

      startDateTime = toMysqlUtcDateTime(start);
      endDateTime = toMysqlUtcDateTime(end);

      campaignStatus = "active";
    } else {
      const start = localDateToUtc(
        selectedStartDate,
        0,
        0,
        0,
        timezone,
      );

      const end = localDateToUtc(
        selectedEndDate,
        23,
        59,
        59,
        timezone,
      );

      startDateTime = toMysqlUtcDateTime(start);
      endDateTime = toMysqlUtcDateTime(end);

      campaignStatus = "pending";
    }
  } else {
    throw createError("Invalid campaign duration type.", 400);
  }

  const result = await model.publishCampaign(
    adId,
    userId,
    {
      startDateTime,
      endDateTime,
      campaignStatus,
    },
  );

  return {
    ...result,
    timezone,
    timestamps_timezone: "UTC",
  };
};

export default {
  saveCampaign,
  publishCampaign,
};
