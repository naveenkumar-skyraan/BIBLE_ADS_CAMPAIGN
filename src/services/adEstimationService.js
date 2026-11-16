import AD_ESTIMATION_CONFIG from "../configs/ads/adEstimationConfig.js";
import { getCurrencyMetadata } from "../utils/currencyConfig.js";

const roundEstimate = (value) => Math.max(0, Math.round(value));

const estimateAdPerformance = ({
  objectiveId,
  adTypeId,
  mediaType,
  totalBudget,
  cpmRate,
  currency,
}) => {
  const adTypeConfig = AD_ESTIMATION_CONFIG.adTypes[Number(adTypeId)];
  const objectiveConfig = AD_ESTIMATION_CONFIG.objectives[Number(objectiveId)];

  if (!adTypeConfig || !objectiveConfig) {
    throw new Error("Estimation configuration not found.");
  }

  const mediaConfig = adTypeConfig[mediaType];
  if (!mediaConfig) throw new Error("Invalid ad media type for estimation.");

  const budget = Number(totalBudget);
  const cpm = Number(cpmRate);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("Invalid campaign budget for estimation.");
  }
  if (!Number.isFinite(cpm) || cpm <= 0) {
    throw new Error("A valid campaign CPM pricing rate is required for estimation.");
  }

  if (!currency) throw new Error("Campaign currency is required for estimation.");
  const currencyMeta = getCurrencyMetadata(currency);
  const adjustedCpm = cpm * objectiveConfig.cpmMultiplier;
  const estimatedImpressions = (budget / adjustedCpm) * 1000;
  const estimatedReach = estimatedImpressions / mediaConfig.frequency;
  const estimatedViews = mediaType === "video"
    ? estimatedImpressions * mediaConfig.viewRate
    : null;

  return {
    currency: currencyMeta.currency_code,
    currency_symbol: currencyMeta.currency_symbol,
    currency_decimal_places: currencyMeta.currency_decimal_places,
    media_type: mediaType,
    estimated_impressions: roundEstimate(estimatedImpressions),
    estimated_reach: roundEstimate(estimatedReach),
    estimated_views: estimatedViews === null ? null : roundEstimate(estimatedViews),
    assumptions: {
      estimated_cpm: Number(adjustedCpm.toFixed(6)),
      pricing_cpm: Number(cpm.toFixed(6)),
      average_frequency: mediaConfig.frequency,
      video_view_rate: mediaType === "video" ? mediaConfig.viewRate : null,
    },
  };
};

export default estimateAdPerformance;
