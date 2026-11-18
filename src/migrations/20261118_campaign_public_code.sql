-- Add a stable, non-sequential campaign identifier for display in the app.
-- Keep ad_campaigns.id as the internal numeric primary key / foreign key.
-- Requires MySQL 8.0+ for ROW_NUMBER().
ALTER TABLE ad_campaigns
  ADD COLUMN campaign_code VARCHAR(12) NULL AFTER id;

-- Give existing campaigns unique eight-digit numeric codes in randomized row
-- order. ROW_NUMBER guarantees no duplicate values in this one-time backfill.
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
)
WHERE campaign.campaign_code IS NULL;

ALTER TABLE ad_campaigns
  MODIFY COLUMN campaign_code VARCHAR(12) NOT NULL,
  ADD UNIQUE KEY uq_ad_campaigns_campaign_code (campaign_code);
