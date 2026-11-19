-- Bible Ads Campaign: immutable pricing snapshots + bounded analytics billing.
-- Target schema: bible_ads_campaign(6).sql supplied with the 2026-11-19 source.
-- Run this migration once before deploying the updated backend.
-- effective_until_timestamp is an exclusive boundary; a snapshot applies to
-- intervals whose interval_start is >= effective_from and < effective_until.

ALTER TABLE ad_campaign_pricing
  ADD COLUMN effective_from_timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0
    AFTER cpc_rate,
  ADD COLUMN effective_until_timestamp BIGINT UNSIGNED DEFAULT NULL
    AFTER effective_from_timestamp,
  ADD COLUMN campaign_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'
    AFTER effective_until_timestamp,
  ADD COLUMN daily_budget DECIMAL(18,6) DEFAULT NULL
    AFTER campaign_timezone,
  ADD COLUMN total_budget DECIMAL(18,6) NOT NULL DEFAULT 0.000000
    AFTER daily_budget,
  ADD COLUMN campaign_start_timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0
    AFTER total_budget,
  ADD COLUMN campaign_end_timestamp BIGINT UNSIGNED DEFAULT NULL
    AFTER campaign_start_timestamp,
  ADD COLUMN business_id BIGINT UNSIGNED DEFAULT NULL
    AFTER campaign_end_timestamp;

-- Backfill the existing one-row-per-platform snapshot from its campaign.
UPDATE ad_campaign_pricing cp
INNER JOIN ad_campaigns c
  ON c.id = cp.campaign_id
SET cp.effective_from_timestamp = COALESCE(
      NULLIF(c.start_timestamp, 0),
      UNIX_TIMESTAMP(c.created_at),
      0
    ),
    cp.campaign_timezone = c.timezone,
    cp.daily_budget = c.daily_budget,
    cp.total_budget = c.total_budget,
    cp.campaign_start_timestamp = COALESCE(c.start_timestamp, 0),
    cp.campaign_end_timestamp = c.end_timestamp,
    cp.business_id = c.business_id;

-- Preserve every historical version while retaining one version per effective
-- timestamp, campaign, ad and platform.
ALTER TABLE ad_campaign_pricing
  DROP INDEX uq_campaign_ad_platform,
  ADD UNIQUE KEY uq_campaign_ad_platform_effective (
    campaign_id,
    ad_id,
    platform,
    effective_from_timestamp
  ),
  ADD KEY idx_campaign_pricing_effective_lookup (
    campaign_id,
    ad_id,
    platform,
    effective_from_timestamp,
    effective_until_timestamp
  );

-- Retain both the received aggregate counts and the billable counts after
-- backend capping. This provides an audit trail without changing the mobile
-- request payload.
ALTER TABLE ad_analytics_batch_items
  ADD COLUMN reported_impressions BIGINT UNSIGNED NOT NULL DEFAULT 0
    AFTER impressions,
  ADD COLUMN reported_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0
    AFTER clicks,
  ADD COLUMN is_capped TINYINT(1) NOT NULL DEFAULT 0
    AFTER reported_clicks,
  ADD COLUMN capping_reason VARCHAR(40) DEFAULT NULL
    AFTER is_capped,
  ADD COLUMN limit_reason VARCHAR(40) DEFAULT NULL
    AFTER capping_reason,
  ADD COLUMN mobile_action VARCHAR(20) DEFAULT NULL
    AFTER limit_reason,
  ADD COLUMN resume_at BIGINT UNSIGNED DEFAULT NULL
    AFTER mobile_action;

UPDATE ad_analytics_batch_items
SET reported_impressions = impressions,
    reported_clicks = clicks
WHERE reported_impressions = 0
  AND reported_clicks = 0;
