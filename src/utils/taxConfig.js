import pool from "../configs/database/db.js";

export const getBusinessTaxConfiguration = async (businessId, connection = pool) => {
  const [rows] = await connection.execute(
    `SELECT bd.id AS business_id, bd.country_code, bd.admin_area_1,
            bd.tax_id, tr.id AS tax_rule_id, tr.tax_name, tr.tax_rate,
            tr.tax_id_label, tr.platform_fee_rate,
            tr.tax_inclusive, tr.is_active
     FROM business_details bd
     LEFT JOIN country_tax_rules tr
       ON tr.country_code = bd.country_code
       AND (tr.admin_area_1 IS NULL OR tr.admin_area_1 = bd.admin_area_1)
       AND tr.is_active = 1
       AND tr.effective_from <= UTC_TIMESTAMP()
       AND (tr.effective_until IS NULL OR tr.effective_until >= UTC_TIMESTAMP())
     WHERE bd.id = ? AND bd.is_deleted = 0
     ORDER BY (tr.admin_area_1 IS NOT NULL) DESC, tr.effective_from DESC, tr.id DESC
     LIMIT 1`,
    [businessId],
  );
  const row = rows[0];
  if (!row) {
    const error = new Error("Business tax details could not be loaded.");
    error.statusCode = 404;
    throw error;
  }
  if (!row.tax_rule_id) {
    const error = new Error(`Tax configuration is not available for business country ${row.country_code}. Configure an active country tax rule before publishing this campaign.`);
    error.statusCode = 409;
    error.code = "COUNTRY_TAX_RULE_NOT_CONFIGURED";
    throw error;
  }
  return {
    business_id: Number(row.business_id),
    country_code: row.country_code,
    tax_rule_id: Number(row.tax_rule_id),
    tax_name: row.tax_name,
    tax_rate: Number(row.tax_rate),
    tax_id_label: row.tax_id_label,
    tax_id_required: false,
    tax_registration_id: row.tax_id || null,
    platform_fee_rate: Number(row.platform_fee_rate),
    tax_inclusive: Number(row.tax_inclusive) === 1,
    tax_basis: "base_ad_spend",
  };
};
