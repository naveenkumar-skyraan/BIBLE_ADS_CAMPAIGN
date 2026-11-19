import {
  calculateAdSpend,
  calculatePercentageMicros,
} from "./adSpendCalculator.js";

const toNonNegativeBigInt = (value, label) => {
  const text = String(value ?? "0");
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return BigInt(text);
};

const minBigInt = (a, b) => (a < b ? a : b);

const findMaximumCount = (lowValue, highValue, fits) => {
  let low = lowValue;
  let high = highValue;

  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    if (fits(mid)) low = mid;
    else high = mid - 1n;
  }

  return low;
};

/**
 * Caps aggregate analytics without allowing a reported batch to exceed the
 * remaining billable spend. Clicks are accepted first, paired with at least
 * one impression each, then remaining impressions are accepted up to the
 * spend ceiling. This deterministic rule is needed because the mobile batch
 * contract contains aggregate counts, not event-level timestamps.
 */
export const capAdEventsToSpendLimit = ({
  impressions,
  clicks,
  cpmRate,
  cpcRate,
  maxSpendMicros,
  platformFeePercent = 30,
  gstPercent = 18,
}) => {
  const reportedImpressions = toNonNegativeBigInt(impressions, "Impressions");
  const reportedClicks = toNonNegativeBigInt(clicks, "Clicks");
  const spendLimit = typeof maxSpendMicros === "bigint"
    ? maxSpendMicros
    : BigInt(maxSpendMicros);

  if (spendLimit < 0n) {
    throw new Error("Maximum spend must be non-negative.");
  }

  const originalCharges = calculateAdSpend({
    impressions: Number(reportedImpressions),
    clicks: Number(reportedClicks),
    cpmRate,
    cpcRate,
    platformFeePercent,
    gstPercent,
  });

  if (originalCharges.totalMicros <= spendLimit) {
    return {
      impressions: Number(reportedImpressions),
      clicks: Number(reportedClicks),
      reportedImpressions: Number(reportedImpressions),
      reportedClicks: Number(reportedClicks),
      wasCapped: false,
      charges: originalCharges,
    };
  }

  // A click must have a corresponding impression. Do not accept more clicks
  // than the submitted impression count, even if the incoming payload is bad.
  const clickUpperBound = minBigInt(reportedClicks, reportedImpressions);
  const acceptedClicks = findMaximumCount(0n, clickUpperBound, (count) => {
    const charges = calculateAdSpend({
      impressions: Number(count),
      clicks: Number(count),
      cpmRate,
      cpcRate,
      platformFeePercent,
      gstPercent,
    });
    return charges.totalMicros <= spendLimit;
  });

  const acceptedImpressions = findMaximumCount(
    acceptedClicks,
    reportedImpressions,
    (count) => {
      const charges = calculateAdSpend({
        impressions: Number(count),
        clicks: Number(acceptedClicks),
        cpmRate,
        cpcRate,
        platformFeePercent,
        gstPercent,
      });
      return charges.totalMicros <= spendLimit;
    },
  );

  const charges = calculateAdSpend({
    impressions: Number(acceptedImpressions),
    clicks: Number(acceptedClicks),
    cpmRate,
    cpcRate,
    platformFeePercent,
    gstPercent,
  });

  if (charges.totalMicros > spendLimit) {
    throw new Error("Analytics spend cap could not be enforced safely.");
  }

  return {
    impressions: Number(acceptedImpressions),
    clicks: Number(acceptedClicks),
    reportedImpressions: Number(reportedImpressions),
    reportedClicks: Number(reportedClicks),
    wasCapped: true,
    charges,
  };
};

/** Returns the largest base ad-spend amount whose fee + GST-inclusive debit
 * fits inside the remaining wallet balance. */
export const getMaxBaseSpendForWalletBalance = (
  walletBalanceMicros,
  platformFeePercent = 30,
  gstPercent = 18,
) => {
  const available = typeof walletBalanceMicros === "bigint"
    ? walletBalanceMicros
    : BigInt(walletBalanceMicros);
  if (available <= 0n) return 0n;

  return findMaximumCount(0n, available, (baseAmount) => {
    const platformFee = calculatePercentageMicros(baseAmount, platformFeePercent);
    const gst = calculatePercentageMicros(baseAmount, gstPercent);
    return baseAmount + platformFee + gst <= available;
  });
};
