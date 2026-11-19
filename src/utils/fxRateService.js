import pool from "../configs/database/db.js";

const BASE_CURRENCY = "USD";
const CACHE_HOURS = Math.max(1, Number(process.env.FX_RATE_CACHE_HOURS || 12));
const FX_API_URL = process.env.FX_RATES_API_URL || "https://api.frankfurter.app/latest";

const fail = (message, code = "FX_RATE_UNAVAILABLE") => {
  const error = new Error(message);
  error.statusCode = 503;
  error.code = code;
  return error;
};

/** Returns local-currency units for one USD. Rates are persisted so every
 * campaign snapshot can retain the exact rate used for its lifetime. */
export const getUsdExchangeRate = async (targetCurrency, connection = pool) => {
  const currency = String(targetCurrency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw fail("A valid target currency is required.");
  if (currency === BASE_CURRENCY) return { base_currency_code: BASE_CURRENCY, currency_code: currency, rate: "1.0000000000", source: "identity", effective_at: new Date() };

  const [cachedRows] = await connection.execute(
    `SELECT base_currency_code, currency_code, exchange_rate AS rate, source, effective_at
     FROM currency_exchange_rates
     WHERE base_currency_code = ? AND currency_code = ?
       AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
     ORDER BY effective_at DESC LIMIT 1`,
    [BASE_CURRENCY, currency, CACHE_HOURS],
  );
  if (cachedRows.length) return cachedRows[0];

  let response;
  try {
    const url = new URL(FX_API_URL);
    url.searchParams.set("from", BASE_CURRENCY);
    url.searchParams.set("to", currency);
    const httpResponse = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!httpResponse.ok) throw new Error(`FX provider returned HTTP ${httpResponse.status}`);
    response = await httpResponse.json();
  } catch (error) {
    throw fail(`Unable to retrieve the USD/${currency} exchange rate: ${error.message}`);
  }

  const rate = Number(response?.rates?.[currency]);
  if (!Number.isFinite(rate) || rate <= 0) throw fail(`The FX provider did not return a valid USD/${currency} rate.`);
  const effectiveAt = response.date || new Date().toISOString().slice(0, 10);
  await connection.execute(
    `INSERT INTO currency_exchange_rates
       (base_currency_code, currency_code, exchange_rate, source, effective_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE exchange_rate = VALUES(exchange_rate), source = VALUES(source), effective_at = VALUES(effective_at), created_at = UTC_TIMESTAMP()`,
    [BASE_CURRENCY, currency, rate.toFixed(10), "frankfurter", `${effectiveAt} 00:00:00`],
  );
  return { base_currency_code: BASE_CURRENCY, currency_code: currency, rate: rate.toFixed(10), source: "frankfurter", effective_at: `${effectiveAt} 00:00:00` };
};

export const convertUsdRate = async (usdAmount, targetCurrency, connection = pool) => {
  const fx = await getUsdExchangeRate(targetCurrency, connection);
  const converted = Number(usdAmount) * Number(fx.rate);
  if (!Number.isFinite(converted) || converted <= 0) throw fail("Converted pricing rate is invalid.");
  return { rate: converted.toFixed(6), fx_rate: fx.rate, fx_source: fx.source, fx_effective_at: fx.effective_at };
};
