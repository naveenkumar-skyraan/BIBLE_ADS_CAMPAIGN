import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const currenciesPath = path.resolve(__dirname, "../configs/json/currencies.json");
const currencyData = JSON.parse(fs.readFileSync(currenciesPath, "utf8"));
const countries = Array.isArray(currencyData?.countries) ? currencyData.countries : [];
const currencyByCountry = new Map(
  countries.map((item) => [String(item.country_code).toUpperCase(), item]),
);
const currencyByCode = new Map();
for (const item of countries) {
  const code = String(item.currency_code || "").toUpperCase();
  if (code && !currencyByCode.has(code)) currencyByCode.set(code, item);
}

const CASHFREE_PUBLISHED_CURRENCIES = new Set([
  "INR", "AUD", "BRL", "CAD", "CNY", "CZK", "EUR", "HKD", "HUF",
  "ILS", "JPY", "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN",
  "GBP", "SGD", "SEK", "CHF", "THB", "USD",
]);

export const getCurrencyByCountryCode = (countryCode) => {
  const code = String(countryCode || "").trim().toUpperCase();
  return currencyByCountry.get(code) || null;
};

export const getCurrencyByCode = (currencyCode) => {
  const code = String(currencyCode || "").trim().toUpperCase();
  const item = currencyByCode.get(code);
  if (!item) return null;
  return {
    currency_code: code,
    currency_symbol: item.currency_symbol || code,
    currency_name: item.currency_name || code,
    currency_decimal_places: Number(item.currency_decimal_places ?? 2),
    cashfree_supported: isCashfreeCurrencySupported(code),
  };
};

export const getCurrencyMetadata = (currencyCode) => {
  const item = getCurrencyByCode(currencyCode);
  if (!item) {
    const error = new Error(`Unsupported currency code: ${currencyCode}`);
    error.statusCode = 400;
    error.code = "UNSUPPORTED_CURRENCY";
    throw error;
  }
  return item;
};

export const getCurrencyForCountry = (countryCode) => {
  const item = getCurrencyByCountryCode(countryCode);
  if (!item) {
    const error = new Error(`No currency is configured for country ${countryCode}.`);
    error.statusCode = 400;
    error.code = "COUNTRY_CURRENCY_NOT_CONFIGURED";
    throw error;
  }
  return getCurrencyMetadata(item.currency_code);
};

export const normalizeMoneyAmount = (
  value,
  currencyCode,
  { min = 0, max = 999999999999.999999 } = {},
) => {
  const meta = getCurrencyMetadata(currencyCode);
  const text = String(value ?? "").trim();
  const match = text.match(/^(?:0|[1-9]\d*)(?:\.(\d+))?$/);
  if (!match) {
    const error = new Error("Amount must be a non-negative decimal number.");
    error.statusCode = 400;
    error.code = "INVALID_MONEY_AMOUNT";
    throw error;
  }
  const fraction = match[1] || "";
  const integerPart = text.split(".")[0];
  if (integerPart.length > 12) {
    const error = new Error("Amount exceeds the maximum supported monetary value.");
    error.statusCode = 400;
    error.code = "INVALID_MONEY_AMOUNT";
    throw error;
  }
  if (fraction.length > meta.currency_decimal_places) {
    const error = new Error(
      `${currencyCode} supports at most ${meta.currency_decimal_places} decimal places.`,
    );
    error.statusCode = 400;
    error.code = "INVALID_MONEY_PRECISION";
    throw error;
  }
  const normalized = meta.currency_decimal_places === 0
    ? text.split(".")[0]
    : `${text.split(".")[0]}.${fraction.padEnd(meta.currency_decimal_places, "0")}`;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    const error = new Error(`Amount must be between ${min} and ${max} ${currencyCode}.`);
    error.statusCode = 400;
    error.code = "INVALID_MONEY_AMOUNT";
    throw error;
  }
  return normalized;
};

export const formatCurrency = (value, currencyCode, locale = undefined) => {
  const meta = getCurrencyMetadata(currencyCode);
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return `${meta.currency_symbol}0`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: meta.currency_code,
      minimumFractionDigits: meta.currency_decimal_places,
      maximumFractionDigits: meta.currency_decimal_places,
    }).format(amount);
  } catch {
    return `${meta.currency_symbol}${amount.toFixed(meta.currency_decimal_places)}`;
  }
};

export const isCashfreeCurrencySupported = (currencyCode) => {
  const code = String(currencyCode || "").toUpperCase();
  return CASHFREE_PUBLISHED_CURRENCIES.has(code);
};

export const assertCashfreeCurrencyEnabled = (currencyCode) => {
  const code = String(currencyCode || "").toUpperCase();
  if (!isCashfreeCurrencySupported(code)) {
    const error = new Error(
      `Cashfree international checkout does not list ${code} as a supported collection currency. This currency can be used for campaign accounting only after another payment method is configured.`,
    );
    error.statusCode = 400;
    error.code = "CASHFREE_CURRENCY_NOT_SUPPORTED";
    throw error;
  }
  if (code !== "INR" && process.env.CASHFREE_INTERNATIONAL_ENABLED !== "true") {
    const error = new Error(
      "International currency checkout is not enabled in this deployment. Confirm that Cashfree has enabled international collections for your merchant account and set CASHFREE_INTERNATIONAL_ENABLED=true.",
    );
    error.statusCode = 400;
    error.code = "CASHFREE_INTERNATIONAL_NOT_ENABLED";
    throw error;
  }
  return code;
};

export const getAllCountryCurrencies = () => countries.map((item) => ({
  country_code: item.country_code,
  country_name: item.country_name,
  currency_code: item.currency_code,
  currency_symbol: item.currency_symbol || item.currency_code,
  currency_name: item.currency_name,
  currency_decimal_places: Number(item.currency_decimal_places ?? 2),
  cashfree_supported: isCashfreeCurrencySupported(item.currency_code),
}));
