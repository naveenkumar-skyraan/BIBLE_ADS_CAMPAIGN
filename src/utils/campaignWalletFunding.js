import {
  decimalToMicros,
  microsToDecimal,
  calculatePercentageMicros,
  PLATFORM_FEE_PERCENT,
  GST_PERCENT,
} from "./adSpendCalculator.js";

export const calculateWalletPayableMicros = (baseAmountMicros) => {
  if (typeof baseAmountMicros !== "bigint" || baseAmountMicros < 0n) {
    throw new Error("Campaign budget must be a non-negative BigInt.");
  }

  const platformFeeMicros = calculatePercentageMicros(
    baseAmountMicros,
    PLATFORM_FEE_PERCENT,
  );
  const gstMicros = calculatePercentageMicros(
    baseAmountMicros,
    GST_PERCENT,
  );

  return {
    baseAmountMicros,
    platformFeeMicros,
    gstMicros,
    payableMicros: baseAmountMicros + platformFeeMicros + gstMicros,
  };
};

export const getWalletCommitmentSummary = async (
  connection,
  userId,
  nowTimestamp,
  currencyCode,
  excludeCampaignId = null,
) => {
  if (!currencyCode) {
    throw new Error("Currency code is required for wallet commitment calculations.");
  }
  const values = [userId, nowTimestamp, String(currencyCode).toUpperCase()];
  let exclusionSql = "";

  if (excludeCampaignId !== null && excludeCampaignId !== undefined) {
    exclusionSql = "AND c.id <> ?";
    values.push(excludeCampaignId);
  }

  const [campaignRows] = await connection.execute(
    `
      SELECT
        c.id,
        c.total_budget,
        c.currency_code,
        COALESCE(SUM(ds.total_charge), 0) AS spent_amount
      FROM ad_campaigns c
      LEFT JOIN ad_campaign_daily_spend ds
        ON ds.campaign_id = c.id
        AND ds.currency_code = c.currency_code
      WHERE c.user_id = ?
        AND c.is_deleted = 0
        AND c.status IN ('active', 'paused', 'draft')
        AND c.start_timestamp IS NOT NULL
        AND c.end_timestamp IS NOT NULL
        AND c.end_timestamp >= ?
        AND c.currency_code = ?
        ${exclusionSql}
      GROUP BY c.id, c.total_budget, c.currency_code
      ORDER BY c.id
    `,
    values,
  );

  let committedBaseMicros = 0n;
  let committedPayableMicros = 0n;

  for (const campaign of campaignRows) {
    const budgetMicros = decimalToMicros(campaign.total_budget);
    const spentMicros = decimalToMicros(campaign.spent_amount);
    const remainingMicros =
      budgetMicros > spentMicros ? budgetMicros - spentMicros : 0n;
    const payable = calculateWalletPayableMicros(remainingMicros);

    committedBaseMicros += remainingMicros;
    committedPayableMicros += payable.payableMicros;
  }

  return {
    currencyCode: String(currencyCode).toUpperCase(),
    campaignCount: campaignRows.length,
    committedBaseMicros,
    committedPayableMicros,
    committedBase: microsToDecimal(committedBaseMicros),
    committedPayable: microsToDecimal(committedPayableMicros),
  };
};
