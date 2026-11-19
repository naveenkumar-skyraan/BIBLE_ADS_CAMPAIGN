-- Bible Ads Campaign: cancellation flag, direct active-ad deletion, and India tax seed.
-- Target: the existing bible_ads_campaign schema exported on 2026-11-19.
-- Safe to run more than once on MySQL 8.x.

SET @schema_name = DATABASE();

-- 1) Add ads.is_cancelled without dropping or changing existing indexes.
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ads'
    AND COLUMN_NAME = 'is_cancelled'
);
SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE ads ADD COLUMN is_cancelled TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''0=not cancelled, 1=cancelled'' AFTER is_deleted',
  'SELECT ''ads.is_cancelled already exists'' AS migration_note'
);
PREPARE migration_stmt FROM @ddl;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- 2) Add a supporting index only if it is not already present.
SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ads'
    AND INDEX_NAME = 'idx_ads_cancelled_status'
);
SET @ddl = IF(
  @index_exists = 0,
  'ALTER TABLE ads ADD INDEX idx_ads_cancelled_status (is_cancelled, status, is_deleted)',
  'SELECT ''idx_ads_cancelled_status already exists'' AS migration_note'
);
PREPARE migration_stmt FROM @ddl;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Existing rows remain not-cancelled. Historical rows in
-- ad_campaign_cancellations may represent a submitted reason, not a completed
-- cancellation, so they are deliberately NOT used to backfill this flag.

-- 3) Seed/refresh the India advertising-service tax configuration.
-- Project-approved values in the supplied database: GST 18%, platform fee 30%.
-- GST is calculated on base advertising spend; GSTIN remains optional.
UPDATE country_tax_rules
SET
  tax_name = 'GST',
  tax_rate = 18.0000,
  platform_fee_rate = 30.0000,
  tax_id_label = 'GSTIN',
  tax_id_required = 0,
  tax_inclusive = 0,
  tax_basis = 'base_ad_spend',
  effective_from = LEAST(effective_from, UTC_TIMESTAMP() - INTERVAL 1 DAY),
  effective_until = NULL,
  is_active = 1,
  updated_at = UTC_TIMESTAMP()
WHERE country_code = 'IN'
  AND admin_area_1 IS NULL;

INSERT INTO country_tax_rules (
  country_code,
  admin_area_1,
  tax_name,
  tax_rate,
  platform_fee_rate,
  tax_id_label,
  tax_id_required,
  tax_inclusive,
  tax_basis,
  effective_from,
  effective_until,
  is_active
)
SELECT
  'IN',
  NULL,
  'GST',
  18.0000,
  30.0000,
  'GSTIN',
  0,
  0,
  'base_ad_spend',
  UTC_TIMESTAMP() - INTERVAL 1 DAY,
  NULL,
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM country_tax_rules
  WHERE country_code = 'IN'
    AND admin_area_1 IS NULL
    AND is_active = 1
    AND effective_from <= UTC_TIMESTAMP()
    AND (effective_until IS NULL OR effective_until >= UTC_TIMESTAMP())
);

-- 4) Backfill tax snapshots for existing campaign pricing rows when the
-- business is in India and the snapshot has not yet captured a tax rule.
UPDATE ad_campaign_pricing cp
INNER JOIN business_details bd
  ON bd.id = cp.business_id
INNER JOIN country_tax_rules tr
  ON tr.country_code = bd.country_code
  AND (tr.admin_area_1 IS NULL OR tr.admin_area_1 = bd.admin_area_1)
  AND tr.is_active = 1
  AND tr.effective_from <= UTC_TIMESTAMP()
  AND (tr.effective_until IS NULL OR tr.effective_until >= UTC_TIMESTAMP())
SET
  cp.tax_rule_id = tr.id,
  cp.tax_name = tr.tax_name,
  cp.tax_rate = tr.tax_rate,
  cp.platform_fee_rate = tr.platform_fee_rate,
  cp.tax_registration_id = bd.tax_id,
  cp.tax_id_label = tr.tax_id_label,
  cp.tax_basis = tr.tax_basis
WHERE cp.tax_rule_id IS NULL
   OR cp.tax_name IS NULL;


-- IMPORTANT: The supplied database contains an India business (country_code='IN').
-- This migration seeds the project-approved India rule only (GST 18%, platform fee 30%).
-- It does NOT invent tax rates for other countries. For a non-IN business, add an
-- active country_tax_rules row using a finance/legal-approved local tax rate before
-- publishing; the backend intentionally fails closed when that country's rule is absent.

-- 5) Verification queries.
SELECT
  id,
  country_code,
  admin_area_1,
  tax_name,
  tax_rate,
  platform_fee_rate,
  tax_id_label,
  tax_id_required,
  tax_inclusive,
  tax_basis,
  effective_from,
  effective_until,
  is_active
FROM country_tax_rules
WHERE country_code = 'IN'
ORDER BY (admin_area_1 IS NOT NULL), effective_from DESC;

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ads'
  AND COLUMN_NAME = 'is_cancelled';
