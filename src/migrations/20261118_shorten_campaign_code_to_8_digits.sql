-- Use this migration ONLY when the earlier 16-hex campaign_code migration
-- has already been executed. It preserves internal campaign IDs and replaces
-- every public campaign code with a unique CMP- + eight-digit numeric code.
-- Requires MySQL 8.0+ for ROW_NUMBER().

UPDATE ad_campaigns AS campaign
JOIN (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY RAND()) AS row_num
  FROM ad_campaigns
) AS numbered_campaigns
  ON numbered_campaigns.id = campaign.id
SET campaign.campaign_code = CONCAT(
  'CMP-',
  LPAD(10000000 + numbered_campaigns.row_num, 8, '0')
);

ALTER TABLE ad_campaigns
  MODIFY COLUMN campaign_code VARCHAR(12) NOT NULL;
