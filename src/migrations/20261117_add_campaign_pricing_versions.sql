-- Required by the campaign edit workflow to retain historical pricing snapshots.
-- Run once against bible_ads_campaign before deploying this src update.
ALTER TABLE ad_campaign_pricing
  ADD COLUMN effective_from_timestamp BIGINT(20) UNSIGNED NULL AFTER created_at,
  ADD COLUMN effective_until_timestamp BIGINT(20) UNSIGNED NULL AFTER effective_from_timestamp,
  ADD COLUMN campaign_timezone VARCHAR(64) NULL AFTER effective_until_timestamp,
  ADD COLUMN daily_budget DECIMAL(18,6) NULL AFTER campaign_timezone,
  ADD COLUMN campaign_start_timestamp BIGINT(20) UNSIGNED NULL AFTER daily_budget,
  ADD COLUMN campaign_end_timestamp BIGINT(20) UNSIGNED NULL AFTER campaign_start_timestamp,
  ADD COLUMN business_id BIGINT(20) UNSIGNED NULL AFTER campaign_end_timestamp;

-- Existing rows remain valid as legacy snapshots. New snapshots created after
-- deployment will carry effective timestamps and campaign context.
CREATE INDEX idx_ad_campaign_pricing_effective
  ON ad_campaign_pricing (campaign_id, platform, effective_from_timestamp, effective_until_timestamp);
