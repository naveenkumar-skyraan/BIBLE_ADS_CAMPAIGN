import test from "node:test";
import assert from "node:assert/strict";

import {
  getAllCountryCurrencies,
  getCurrencyForCountry,
  getCurrencyMetadata,
  isCashfreeCurrencySupported,
  normalizeMoneyAmount,
  assertCashfreeCurrencyEnabled,
} from "../utils/currencyConfig.js";
import {
  calculateAdSpend,
  decimalToMicros,
  microsToDecimal,
  microsToCurrencyDecimal,
  roundMicrosToMinorUnit,
} from "../utils/adSpendCalculator.js";

test("currency JSON covers 195 countries and 142 ISO currency codes", () => {
  const countries = getAllCountryCurrencies();
  assert.equal(countries.length, 195);
  assert.equal(new Set(countries.map((row) => row.country_code)).size, 195);
  assert.equal(new Set(countries.map((row) => row.currency_code)).size, 142);
});

test("country mapping returns expected metadata for common and zero/three-decimal currencies", () => {
  assert.equal(getCurrencyForCountry("IN").currency_code, "INR");
  assert.equal(getCurrencyForCountry("US").currency_code, "USD");
  assert.equal(getCurrencyForCountry("GB").currency_code, "GBP");
  assert.equal(getCurrencyMetadata("JPY").currency_decimal_places, 0);
  assert.equal(getCurrencyMetadata("KWD").currency_decimal_places, 3);
});

test("amount normalization applies currency-specific decimal precision", () => {
  assert.equal(normalizeMoneyAmount("100", "JPY"), "100");
  assert.equal(normalizeMoneyAmount("100.5", "INR"), "100.50");
  assert.equal(normalizeMoneyAmount("10.125", "KWD"), "10.125");
  assert.throws(
    () => normalizeMoneyAmount("100.5", "JPY"),
    (error) => error.code === "INVALID_MONEY_PRECISION",
  );
  assert.throws(
    () => normalizeMoneyAmount("-1", "INR"),
    (error) => error.code === "INVALID_MONEY_AMOUNT",
  );
});

test("Cashfree allowlist is independent from the country currency catalog", () => {
  assert.equal(isCashfreeCurrencySupported("INR"), true);
  assert.equal(isCashfreeCurrencySupported("USD"), true);
  assert.equal(isCashfreeCurrencySupported("KWD"), false);

  const oldFlag = process.env.CASHFREE_INTERNATIONAL_ENABLED;
  delete process.env.CASHFREE_INTERNATIONAL_ENABLED;
  assert.throws(
    () => assertCashfreeCurrencyEnabled("USD"),
    (error) => error.code === "CASHFREE_INTERNATIONAL_NOT_ENABLED",
  );
  process.env.CASHFREE_INTERNATIONAL_ENABLED = "true";
  assert.equal(assertCashfreeCurrencyEnabled("USD"), "USD");
  assert.throws(
    () => assertCashfreeCurrencyEnabled("KWD"),
    (error) => error.code === "CASHFREE_CURRENCY_NOT_SUPPORTED",
  );
  if (oldFlag === undefined) delete process.env.CASHFREE_INTERNATIONAL_ENABLED;
  else process.env.CASHFREE_INTERNATIONAL_ENABLED = oldFlag;
});

test("CPM, CPC, platform fee, GST and wallet debit reconcile exactly in micros", () => {
  const result = calculateAdSpend({
    impressions: 10_000,
    clicks: 10,
    cpmRate: "50.000000",
    cpcRate: "2.000000",
  });

  assert.equal(microsToDecimal(result.impressionMicros), "500.000000");
  assert.equal(microsToDecimal(result.clickMicros), "20.000000");
  assert.equal(microsToDecimal(result.totalMicros), "520.000000");
  assert.equal(microsToDecimal(result.platformFeeMicros), "156.000000");
  assert.equal(microsToDecimal(result.gstMicros), "93.600000");
  assert.equal(microsToDecimal(result.walletDebitMicros), "769.600000");
  assert.equal(
    result.walletDebitMicros,
    result.totalMicros + result.platformFeeMicros + result.gstMicros,
  );
});

test("minor-unit rounding handles zero-, two- and three-decimal currencies", () => {
  assert.equal(microsToCurrencyDecimal(decimalToMicros("1.236"), 0), "1");
  assert.equal(microsToCurrencyDecimal(decimalToMicros("1.236"), 2), "1.24");
  assert.equal(microsToCurrencyDecimal(decimalToMicros("1.2346"), 3), "1.235");
  assert.equal(
    roundMicrosToMinorUnit(decimalToMicros("1.234567"), 3),
    decimalToMicros("1.235000"),
  );
});
