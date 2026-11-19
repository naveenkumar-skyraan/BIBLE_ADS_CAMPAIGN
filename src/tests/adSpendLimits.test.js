import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdSpend,
  decimalToMicros,
  microsToDecimal,
} from "../utils/adSpendCalculator.js";
import {
  capAdEventsToSpendLimit,
  getMaxBaseSpendForWalletBalance,
} from "../utils/adSpendLimits.js";

test("analytics spend cap preserves original counts when the batch is within budget", () => {
  const result = capAdEventsToSpendLimit({
    impressions: 1000,
    clicks: 10,
    cpmRate: "10.000000",
    cpcRate: "1.000000",
    maxSpendMicros: decimalToMicros("20.000000"),
  });

  assert.equal(result.wasCapped, false);
  assert.equal(result.impressions, 1000);
  assert.equal(result.clicks, 10);
  assert.equal(result.charges.totalMicros, decimalToMicros("20.000000"));
});

test("analytics spend cap stops at the exact permitted spend and reports truncated counts", () => {
  const result = capAdEventsToSpendLimit({
    impressions: 1000,
    clicks: 10,
    cpmRate: "10.000000",
    cpcRate: "1.000000",
    maxSpendMicros: decimalToMicros("12.000000"),
  });

  assert.equal(result.wasCapped, true);
  assert.equal(result.reportedImpressions, 1000);
  assert.equal(result.reportedClicks, 10);
  assert.equal(result.clicks, 10);
  assert.equal(result.impressions, 200);
  assert.equal(result.charges.totalMicros, decimalToMicros("12.000000"));
  assert.ok(result.charges.totalMicros <= decimalToMicros("12.000000"));
});

test("analytics spend cap accepts affordable impressions when a click cannot fit", () => {
  const result = capAdEventsToSpendLimit({
    impressions: 1000,
    clicks: 1,
    cpmRate: "50.000000",
    cpcRate: "2.000000",
    maxSpendMicros: decimalToMicros("1.000000"),
  });

  assert.equal(result.wasCapped, true);
  assert.equal(result.clicks, 0);
  assert.equal(result.impressions, 20);
  assert.equal(result.charges.totalMicros, decimalToMicros("1.000000"));
});

test("zero remaining spend accepts zero billable events", () => {
  const result = capAdEventsToSpendLimit({
    impressions: 100,
    clicks: 5,
    cpmRate: "50.000000",
    cpcRate: "2.000000",
    maxSpendMicros: 0n,
  });

  assert.equal(result.wasCapped, true);
  assert.equal(result.impressions, 0);
  assert.equal(result.clicks, 0);
  assert.equal(result.charges.totalMicros, 0n);
});

test("wallet capacity includes platform fee and GST", () => {
  const spendLimit = getMaxBaseSpendForWalletBalance(decimalToMicros("148.000000"));
  const debit = calculateAdSpend({
    impressions: 0,
    clicks: 100,
    cpmRate: "0.000000",
    cpcRate: microsToDecimal(spendLimit / 100n),
  }).walletDebitMicros;

  assert.equal(spendLimit, decimalToMicros("100.000000"));
  assert.equal(debit, decimalToMicros("148.000000"));
});
