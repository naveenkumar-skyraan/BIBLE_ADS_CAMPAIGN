import { randomInt } from "node:crypto";

const CAMPAIGN_CODE_INDEX = "uq_ad_campaigns_campaign_code";
const MIN_CAMPAIGN_CODE = 10_000_000;
const MAX_CAMPAIGN_CODE_EXCLUSIVE = 100_000_000;

/**
 * Public campaign identifier: CMP- followed by exactly eight random digits.
 * The numeric ad_campaigns.id remains the internal primary/foreign key.
 */
export const generateCampaignCode = () =>
  `CMP-${randomInt(MIN_CAMPAIGN_CODE, MAX_CAMPAIGN_CODE_EXCLUSIVE)}`;

/**
 * Insert a campaign while retrying the extremely unlikely public-code collision.
 * The unique database index remains the source of truth for uniqueness.
 * `values` must contain every INSERT value except the first campaign_code value.
 */
export const insertCampaignWithUniqueCode = async (
  connection,
  sql,
  values,
  maxAttempts = 5,
) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await connection.execute(sql, [generateCampaignCode(), ...values]);
    } catch (error) {
      const errorMessage = `${error?.sqlMessage ?? ""} ${error?.message ?? ""}`;
      const isCampaignCodeCollision =
        error?.code === "ER_DUP_ENTRY" &&
        errorMessage.toLowerCase().includes(CAMPAIGN_CODE_INDEX);

      if (!isCampaignCodeCollision || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate a unique campaign code.");
};
