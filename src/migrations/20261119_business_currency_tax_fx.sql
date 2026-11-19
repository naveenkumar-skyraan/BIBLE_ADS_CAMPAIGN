-- Business-country billing: USD reference pricing, persisted FX rates and tax rules.
-- Apply once after the supplied bible_ads_campaign(8).sql schema.

CREATE TABLE IF NOT EXISTS currency_exchange_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  base_currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'USD',
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  exchange_rate DECIMAL(20,10) NOT NULL,
  source VARCHAR(40) NOT NULL,
  effective_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_currency_exchange_effective (base_currency_code, currency_code, effective_at),
  KEY idx_currency_exchange_latest (base_currency_code, currency_code, effective_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS country_tax_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  country_code CHAR(2) NOT NULL,
  admin_area_1 VARCHAR(150) DEFAULT NULL,
  tax_name VARCHAR(60) NOT NULL,
  tax_rate DECIMAL(8,4) NOT NULL,
  platform_fee_rate DECIMAL(8,4) NOT NULL DEFAULT 30.0000,
  tax_id_label VARCHAR(60) DEFAULT NULL,
  tax_id_required TINYINT(1) NOT NULL DEFAULT 0,
  tax_inclusive TINYINT(1) NOT NULL DEFAULT 0,
  tax_basis ENUM('base_ad_spend') NOT NULL DEFAULT 'base_ad_spend',
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_until DATETIME DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_country_tax_lookup (country_code, admin_area_1, is_active, effective_from, effective_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ad_campaign_pricing
  ADD COLUMN base_currency_code CHAR(3) NOT NULL DEFAULT 'USD' AFTER business_id,
  ADD COLUMN base_cpm_rate DECIMAL(18,6) DEFAULT NULL AFTER base_currency_code,
  ADD COLUMN base_cpc_rate DECIMAL(18,6) DEFAULT NULL AFTER base_cpm_rate,
  ADD COLUMN fx_rate_to_currency DECIMAL(20,10) DEFAULT NULL AFTER base_cpc_rate,
  ADD COLUMN fx_source VARCHAR(40) DEFAULT NULL AFTER fx_rate_to_currency,
  ADD COLUMN fx_effective_at DATETIME DEFAULT NULL AFTER fx_source,
  ADD COLUMN tax_rule_id BIGINT UNSIGNED DEFAULT NULL AFTER fx_effective_at,
  ADD COLUMN tax_name VARCHAR(60) DEFAULT NULL AFTER tax_rule_id,
  ADD COLUMN tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0 AFTER tax_name,
  ADD COLUMN platform_fee_rate DECIMAL(8,4) NOT NULL DEFAULT 30 AFTER tax_rate,
  ADD COLUMN tax_registration_id VARCHAR(100) DEFAULT NULL AFTER platform_fee_rate,
  ADD COLUMN tax_id_label VARCHAR(60) DEFAULT NULL AFTER tax_registration_id,
  ADD COLUMN tax_basis ENUM('base_ad_spend') NOT NULL DEFAULT 'base_ad_spend' AFTER tax_id_label;

-- Existing INR-only rules are intentionally not converted using an invented
-- rate. Create approved USD CPM/CPC rules through Admin Pricing before publish.
-- India default from the existing project commercial assumption. Update the
-- effective date/rate with finance-approved values before production use.
INSERT INTO country_tax_rules (
  country_code, admin_area_1, tax_name, tax_rate, platform_fee_rate,
  tax_id_label, tax_id_required, tax_basis, effective_from, is_active
)
SELECT 'IN', NULL, 'GST', 18.0000, 30.0000, 'GSTIN', 0,
       'base_ad_spend', UTC_TIMESTAMP(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM country_tax_rules
  WHERE country_code = 'IN' AND admin_area_1 IS NULL AND is_active = 1
);

-- Backfill tax values for existing campaign snapshots where a country rule
-- exists. Historical local CPM/CPC rates remain untouched.
UPDATE ad_campaign_pricing cp
INNER JOIN business_details bd ON bd.id = cp.business_id
INNER JOIN country_tax_rules tr
  ON tr.country_code = bd.country_code
  AND (tr.admin_area_1 IS NULL OR tr.admin_area_1 = bd.admin_area_1)
  AND tr.is_active = 1
  AND tr.effective_from <= UTC_TIMESTAMP()
  AND (tr.effective_until IS NULL OR tr.effective_until >= UTC_TIMESTAMP())
SET cp.tax_rule_id = tr.id,
    cp.tax_name = tr.tax_name,
    cp.tax_rate = tr.tax_rate,
    cp.platform_fee_rate = tr.platform_fee_rate,
    cp.tax_registration_id = bd.tax_id,
    cp.tax_id_label = tr.tax_id_label,
    cp.tax_basis = 'base_ad_spend';

-- For every other supported country, insert an approved tax rule before
-- campaigns can be published. Example (replace with tax/legal-approved values):
-- INSERT INTO country_tax_rules
-- (country_code, tax_name, tax_rate, platform_fee_rate, tax_id_label,
--  tax_id_required, tax_basis, effective_from, is_active)
-- VALUES ('US', 'Sales Tax', <APPROVED_RATE>, 30.0000, 'Tax ID', 0,
--         'base_ad_spend', UTC_TIMESTAMP(), 1);
