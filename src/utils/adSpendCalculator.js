const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 30);
// Retained only as a compatibility default for existing tests/callers. Live
// billing passes the country tax rate from the campaign pricing snapshot.
const GST_PERCENT = Number(process.env.DEFAULT_TAX_PERCENT || 18);

// All internal wallet and accrual amounts use millionths of the currency unit.
// This keeps spend arithmetic stable for currencies with 0, 2 or 3 minor units.
export const decimalToMicros = (value) => {
  const text = String(value ?? "0").trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) throw new Error(`Invalid monetary value: ${text}`);
  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = (match[3] || "").padEnd(6, "0");
  return sign * (BigInt(match[2]) * 1000000n + BigInt(fraction || "0"));
};

export const microsToDecimal = (value) => {
  const amount = typeof value === "bigint" ? value : BigInt(value || 0);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 1000000n;
  const fraction = String(absolute % 1000000n).padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
};

export const roundMicrosToMinorUnit = (amountMicros, decimalPlaces = 2) => {
  if (typeof amountMicros !== "bigint") throw new Error("Amount must be BigInt.");
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) {
    throw new Error("Currency decimal places must be an integer from 0 to 6.");
  }
  const scale = 10n ** BigInt(6 - decimalPlaces);
  const sign = amountMicros < 0n ? -1n : 1n;
  const absolute = amountMicros < 0n ? -amountMicros : amountMicros;
  return ((absolute + scale / 2n) / scale) * scale * sign;
};

export const microsToCurrencyDecimal = (amountMicros, decimalPlaces = 2) => {
  const normalized = microsToDecimal(roundMicrosToMinorUnit(amountMicros, decimalPlaces));
  if (decimalPlaces === 0) return normalized.split(".")[0];
  return normalized.slice(0, -(6 - decimalPlaces));
};

export const calculatePercentageMicros = (amountMicros, percentage) => {
  if (typeof amountMicros !== "bigint" || amountMicros < 0n) {
    throw new Error("Amount must be a non-negative BigInt.");
  }
  if (!Number.isFinite(Number(percentage)) || Number(percentage) < 0) {
    throw new Error("Percentage must be a non-negative number.");
  }
  const basisPoints = BigInt(Math.round(Number(percentage) * 100));
  return (amountMicros * basisPoints + 5000n) / 10000n;
};

const calculateAdSpend = ({
  impressions,
  clicks,
  cpmRate,
  cpcRate,
  platformFeePercent = PLATFORM_FEE_PERCENT,
  gstPercent = GST_PERCENT,
}) => {
  const impressionText = String(impressions);
  const clickText = String(clicks);
  if (!/^\d+$/.test(impressionText) || !/^\d+$/.test(clickText)) {
    throw new Error("Impressions and clicks must be non-negative integers.");
  }

  const cpmMicros = decimalToMicros(cpmRate);
  const cpcMicros = decimalToMicros(cpcRate);
  const impressionCount = BigInt(impressionText);
  const clickCount = BigInt(clickText);

  // CPM is a rate per 1,000 impressions. Round only once to the internal
  // micro-unit to avoid per-impression rounding drift.
  const impressionMicros = (impressionCount * cpmMicros + 500n) / 1000n;
  const clickMicros = clickCount * cpcMicros;
  const totalMicros = impressionMicros + clickMicros;
  const platformFeeMicros = calculatePercentageMicros(totalMicros, platformFeePercent);
  const gstMicros = calculatePercentageMicros(totalMicros, gstPercent);
  const walletDebitMicros = totalMicros + platformFeeMicros + gstMicros;

  return {
    impressionMicros,
    clickMicros,
    totalMicros,
    platformFeeMicros,
    gstMicros,
    walletDebitMicros,
  };
};

export { calculateAdSpend, PLATFORM_FEE_PERCENT, GST_PERCENT };
