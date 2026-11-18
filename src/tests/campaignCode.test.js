import test from "node:test";
import assert from "node:assert/strict";
import { generateCampaignCode, insertCampaignWithUniqueCode } from "../utils/campaignCode.js";

test("campaign codes use the public CMP- prefix and exactly eight digits", () => {
  const value = generateCampaignCode();
  assert.match(value, /^CMP-\d{8}$/);
});

test("campaign insert retries when the unique campaign-code index collides", async () => {
  const attemptedCodes = [];
  let callCount = 0;
  const connection = {
    async execute(_sql, values) {
      callCount += 1;
      attemptedCodes.push(values[0]);

      if (callCount === 1) {
        const error = new Error(
          "Duplicate entry for key 'uq_ad_campaigns_campaign_code'",
        );
        error.code = "ER_DUP_ENTRY";
        throw error;
      }

      return [{ insertId: 123 }, undefined];
    },
  };

  const result = await insertCampaignWithUniqueCode(
    connection,
    "INSERT INTO ad_campaigns (campaign_code, user_id) VALUES (?, ?)",
    [7],
  );

  assert.equal(callCount, 2);
  assert.match(attemptedCodes[0], /^CMP-\d{8}$/);
  assert.match(attemptedCodes[1], /^CMP-\d{8}$/);
  assert.notEqual(attemptedCodes[0], attemptedCodes[1]);
  assert.equal(result[0].insertId, 123);
});
