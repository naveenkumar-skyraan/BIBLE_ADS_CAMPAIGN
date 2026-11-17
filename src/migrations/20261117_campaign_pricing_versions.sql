-- Preserve historical pricing, campaign timezone, daily budget and schedule
-- boundaries when an advertiser edits a live campaign.
-- Existing snapshots are valid from the beginning of time until replaced.
ALTER TABLE ad_campaign_pricing
  ADD COLUMN effective_from_timestamp BIGINT(20) UNSIGNED NOT NULL DEFAULT 0
    AFTER cpc_rate,
  ADD COLUMN effective_until_timestamp BIGINT(20) UNSIGNED DEFAULT NULL
    AFTER effective_from_timestamp,
  ADD COLUMN campaign_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'
    AFTER effective_until_timestamp,
  ADD COLUMN daily_budget DECIMAL(18,6) DEFAULT NULL
    AFTER campaign_timezone,
  ADD COLUMN campaign_start_timestamp BIGINT(20) UNSIGNED NOT NULL DEFAULT 0
    AFTER daily_budget,
  ADD COLUMN campaign_end_timestamp BIGINT(20) UNSIGNED DEFAULT NULL
    AFTER campaign_start_timestamp,
  ADD COLUMN business_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0
    AFTER campaign_end_timestamp,
  DROP INDEX uq_campaign_ad_platform,
  ADD KEY idx_campaign_pricing_effective (
    campaign_id,
    ad_id,
    platform,
    effective_from_timestamp,
    effective_until_timestamp
  );

UPDATE ad_campaign_pricing cp
INNER JOIN ad_campaigns c ON c.id = cp.campaign_id
SET cp.campaign_timezone = c.timezone,
    cp.daily_budget = c.daily_budget,
    cp.campaign_start_timestamp = COALESCE(c.start_timestamp, 0),
    cp.campaign_end_timestamp = c.end_timestamp,
    cp.business_id = c.business_id;
