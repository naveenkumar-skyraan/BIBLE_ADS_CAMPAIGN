-- Bible Ads Campaign: global USD pricing and optional tax ID policy.
-- Run once against bible_ads_campaign after the current schema is deployed.
-- The existing INR 50 CPM / INR 2 CPC baseline is translated to USD reference
-- rates of USD 0.60 CPM / USD 0.024 CPC using an approximate 83.3333 INR/USD
-- commercial conversion. Adjust these two USD rates if finance has approved
-- different base pricing.

START TRANSACTION;

-- Tax registration IDs are optional in every country. Keep the legacy column
-- for compatibility, but ensure existing rules do not advertise it as required.
UPDATE country_tax_rules
SET tax_id_required = 0,
    updated_at = UTC_TIMESTAMP();

-- Retire prior currency-specific/scoped rules so the same USD base rates apply
-- globally. Existing historical rows are retained for audit purposes.
UPDATE ad_pricing_rules
SET is_active = 0,
    effective_until = COALESCE(effective_until, UTC_TIMESTAMP()),
    updated_at = UTC_TIMESTAMP()
WHERE is_active = 1
  AND NOT (
    currency_code = 'USD'
    AND objective_id IS NULL
    AND ad_type_id IS NULL
    AND ad_subtype_id IS NULL
    AND country_code IS NULL
    AND admin_area_1 IS NULL
    AND city IS NULL
    AND platform = 'all'
  );

-- Update the global USD rows if they already exist.
UPDATE ad_pricing_rules
SET rate = CASE billing_model
      WHEN 'cpm' THEN 0.600000
      WHEN 'cpc' THEN 0.024000
      ELSE rate
    END,
    effective_from = UTC_TIMESTAMP(),
    effective_until = NULL,
    is_active = 1,
    updated_at = UTC_TIMESTAMP()
WHERE currency_code = 'USD'
  AND objective_id IS NULL
  AND ad_type_id IS NULL
  AND ad_subtype_id IS NULL
  AND country_code IS NULL
  AND admin_area_1 IS NULL
  AND city IS NULL
  AND platform = 'all'
  AND billing_model IN ('cpm', 'cpc');

-- Insert a global CPM rule only if one does not already exist.
INSERT INTO ad_pricing_rules (
  objective_id, ad_type_id, ad_subtype_id, billing_model,
  country_code, admin_area_1, city, platform,
  currency_code, rate, effective_from, effective_until, is_active
)
SELECT NULL, NULL, NULL, 'cpm',
       NULL, NULL, NULL, 'all',
       'USD', 0.600000, UTC_TIMESTAMP(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1
  FROM ad_pricing_rules
  WHERE billing_model = 'cpm'
    AND currency_code = 'USD'
    AND objective_id IS NULL
    AND ad_type_id IS NULL
    AND ad_subtype_id IS NULL
    AND country_code IS NULL
    AND admin_area_1 IS NULL
    AND city IS NULL
    AND platform = 'all'
    AND is_active = 1
);

-- Insert a global CPC rule only if one does not already exist.
INSERT INTO ad_pricing_rules (
  objective_id, ad_type_id, ad_subtype_id, billing_model,
  country_code, admin_area_1, city, platform,
  currency_code, rate, effective_from, effective_until, is_active
)
SELECT NULL, NULL, NULL, 'cpc',
       NULL, NULL, NULL, 'all',
       'USD', 0.024000, UTC_TIMESTAMP(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1
  FROM ad_pricing_rules
  WHERE billing_model = 'cpc'
    AND currency_code = 'USD'
    AND objective_id IS NULL
    AND ad_type_id IS NULL
    AND ad_subtype_id IS NULL
    AND country_code IS NULL
    AND admin_area_1 IS NULL
    AND city IS NULL
    AND platform = 'all'
    AND is_active = 1
);

COMMIT;
