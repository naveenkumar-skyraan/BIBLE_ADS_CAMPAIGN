import {
  decimalToMicros,
  microsToDecimal,
  calculatePercentageMicros,
  PLATFORM_FEE_PERCENT,
  GST_PERCENT,
} from "./adSpendCalculator.js";

export const calculateWalletPayableMicros = (baseAmountMicros, platformFeePercent = PLATFORM_FEE_PERCENT, taxPercent = GST_PERCENT) => {
  if (typeof baseAmountMicros !== "bigint" || baseAmountMicros < 0n) {
    throw new Error("Campaign budget must be a non-negative BigInt.");
  }

  const platformFeeMicros = calculatePercentageMicros(
    baseAmountMicros,
    platformFeePercent,
  );
  // Tax is calculated on base ad spend only, not on the platform fee.
  const gstMicros = calculatePercentageMicros(
    baseAmountMicros,
    taxPercent,
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
        COALESCE(SUM(ds.total_charge), 0) AS spent_amount,
        COALESCE(
          (SELECT p.platform_fee_rate FROM ad_campaign_pricing p
           WHERE p.campaign_id = c.id AND p.effective_until_timestamp IS NULL
           ORDER BY p.effective_from_timestamp DESC LIMIT 1),
          (SELECT tr.platform_fee_rate FROM country_tax_rules tr
           WHERE tr.country_code = bd.country_code
             AND (tr.admin_area_1 IS NULL OR tr.admin_area_1 = bd.admin_area_1)
             AND tr.is_active = 1 AND tr.effective_from <= UTC_TIMESTAMP()
             AND (tr.effective_until IS NULL OR tr.effective_until >= UTC_TIMESTAMP())
           ORDER BY (tr.admin_area_1 IS NOT NULL) DESC, tr.effective_from DESC, tr.id DESC LIMIT 1),
          30
        ) AS platform_fee_rate,
        COALESCE(
          (SELECT p.tax_rate FROM ad_campaign_pricing p
           WHERE p.campaign_id = c.id AND p.effective_until_timestamp IS NULL
           ORDER BY p.effective_from_timestamp DESC LIMIT 1),
          (SELECT tr.tax_rate FROM country_tax_rules tr
           WHERE tr.country_code = bd.country_code
             AND (tr.admin_area_1 IS NULL OR tr.admin_area_1 = bd.admin_area_1)
             AND tr.is_active = 1 AND tr.effective_from <= UTC_TIMESTAMP()
             AND (tr.effective_until IS NULL OR tr.effective_until >= UTC_TIMESTAMP())
           ORDER BY (tr.admin_area_1 IS NOT NULL) DESC, tr.effective_from DESC, tr.id DESC LIMIT 1),
          0
        ) AS tax_rate
      FROM ad_campaigns c
      INNER JOIN business_details bd ON bd.id = c.business_id AND bd.is_deleted = 0
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
    const payable = calculateWalletPayableMicros(
      remainingMicros,
      Number(campaign.platform_fee_rate),
      Number(campaign.tax_rate),
    );

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
