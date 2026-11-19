import pool from "../configs/database/db.js";


const getPricingRuleSelectQuery = () => `
    SELECT
        pr.*,
        ao.name AS objective_name,
        at.name AS ad_type_name,
        ast.name AS ad_subtype_name
    FROM ad_pricing_rules pr
    LEFT JOIN ad_objectives ao
        ON ao.id = pr.objective_id
    LEFT JOIN ad_types at
        ON at.id = pr.ad_type_id
    LEFT JOIN ad_subtypes ast
        ON ast.id = pr.ad_subtype_id
`;


const validateCurrencyCountry = ({ currency_code }) => {
  if (String(currency_code || "").toUpperCase() !== "USD") {
    const error = new Error("Campaign pricing rules must be entered in USD, the base reference currency. The backend converts them using the saved USD exchange rate for the business currency.");
    error.statusCode = 400;
    throw error;
  }
};

const normalizePricingRuleData = (data) => ({
  ...data,
  objective_id: data.objective_id ?? null,
  ad_type_id: data.ad_type_id ?? null,
  ad_subtype_id: data.ad_subtype_id ?? null,
  country_code: data.country_code ?? null,
  admin_area_1: data.admin_area_1 ?? null,
  city: data.city ?? null,
});

const validateReferences = async ({
  objective_id,
  ad_type_id,
  ad_subtype_id,
}) => {
  if (objective_id !== null) {
    const [objectives] = await pool.execute(
      `SELECT id
             FROM ad_objectives
             WHERE id = ? AND is_active = 1
             LIMIT 1`,
      [objective_id],
    );

    if (!objectives.length) {
      throw new Error("Invalid or inactive ad objective");
    }
  }

  if (ad_type_id !== null) {
    const [types] = await pool.execute(
      `SELECT id
             FROM ad_types
             WHERE id = ? AND is_active = 1
             LIMIT 1`,
      [ad_type_id],
    );

    if (!types.length) {
      throw new Error("Invalid or inactive ad type");
    }
  }

  if (ad_subtype_id !== null) {
    if (ad_type_id === null) {
      throw new Error("An ad type is required when an ad subtype is selected");
    }

    const [subtypes] = await pool.execute(
      `SELECT id
             FROM ad_subtypes
             WHERE id = ?
               AND ad_type_id = ?
               AND is_active = 1
             LIMIT 1`,
      [ad_subtype_id, ad_type_id],
    );

    if (!subtypes.length) {
      throw new Error(
        "Invalid or inactive ad subtype for the selected ad type",
      );
    }
  }
};

const checkPricingRuleOverlap = async ({
  objective_id = null,
  ad_type_id = null,
  ad_subtype_id = null,
  billing_model,
  country_code = null,
  admin_area_1 = null,
  city = null,
  platform,
  currency_code,
  effective_from,
  effective_until = null,
  exclude_id = null,
}) => {
  const params = [
    objective_id,
    ad_type_id,
    ad_subtype_id,
    billing_model,
    country_code,
    admin_area_1,
    city,
    platform,
    currency_code,
    effective_from,
    effective_until,
    effective_until,
  ];

  let query = `
        SELECT id
        FROM ad_pricing_rules
        WHERE is_active = 1
          AND objective_id <=> ?
          AND ad_type_id <=> ?
          AND ad_subtype_id <=> ?
          AND billing_model = ?
          AND country_code <=> ?
          AND admin_area_1 <=> ?
          AND city <=> ?
          AND platform = ?
          AND currency_code = ?
          AND (
                effective_until IS NULL
                OR effective_until >= ?
          )
          AND (
                ? IS NULL
                OR effective_from <= ?
          )
    `;

  if (exclude_id !== null) {
    query += " AND id != ?";
    params.push(exclude_id);
  }

  query += " LIMIT 1";

  const [rows] = await pool.execute(query, params);

  if (rows.length) {
    throw new Error(
      "An active pricing rule already exists for this configuration and effective period",
    );
  }
};

export const createPricingRule = async (data) => {
  const normalizedData = normalizePricingRuleData(data);

  validateCurrencyCountry(normalizedData);
  await validateReferences(normalizedData);

  if (Number(normalizedData.is_active ?? 1) === 1) {
    await checkPricingRuleOverlap(normalizedData);
  }

  const {
    objective_id,
    ad_type_id,
    ad_subtype_id,
    billing_model,
    country_code,
    admin_area_1,
    city,
    platform,
    currency_code,
    rate,
    effective_from,
    effective_until = null,
    is_active = 1,
  } = normalizedData;

  const [result] = await pool.execute(
    `INSERT INTO ad_pricing_rules (
            objective_id,
            ad_type_id,
            ad_subtype_id,
            billing_model,
            country_code,
            admin_area_1,
            city,
            platform,
            currency_code,
            rate,
            effective_from,
            effective_until,
            is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      objective_id,
      ad_type_id,
      ad_subtype_id,
      billing_model,
      country_code,
      admin_area_1,
      city,
      platform,
      currency_code,
      rate,
      effective_from,
      effective_until,
      is_active,
    ],
  );

  return result.insertId;
};

export const getPricingRules = async ({
  page = 1,
  limit = 10,
  search = null,
  objective_id = null,
  ad_type_id = null,
  ad_subtype_id = null,
  billing_model = null,
  country_code = null,
  admin_area_1 = null,
  city = null,
  platform = null,
  currency_code = null,
  is_active = null,
}) => {
  const currentPage = Number(page);
  const pageSize = Number(limit);
  const offset = (currentPage - 1) * pageSize;

  let whereQuery = " WHERE 1 = 1";
  const params = [];

  if (search) {
    whereQuery += `
            AND (
                ao.name LIKE ?
                OR at.name LIKE ?
                OR ast.name LIKE ?
                OR pr.country_code LIKE ?
                OR pr.currency_code LIKE ?
            )
        `;

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    );
  }

  if (objective_id !== null && objective_id !== undefined) {
    whereQuery += " AND pr.objective_id = ?";
    params.push(objective_id);
  }

  if (ad_type_id !== null && ad_type_id !== undefined) {
    whereQuery += " AND pr.ad_type_id = ?";
    params.push(ad_type_id);
  }

  if (ad_subtype_id !== null && ad_subtype_id !== undefined) {
    whereQuery += " AND pr.ad_subtype_id = ?";
    params.push(ad_subtype_id);
  }

  if (billing_model) {
    whereQuery += " AND pr.billing_model = ?";
    params.push(billing_model);
  }

  if (country_code) {
    whereQuery += " AND pr.country_code = ?";
    params.push(country_code);
  }

  if (admin_area_1) {
    whereQuery += " AND pr.admin_area_1 = ?";
    params.push(admin_area_1);
  }

  if (city) {
    whereQuery += " AND pr.city = ?";
    params.push(city);
  }

  if (platform) {
    whereQuery += " AND pr.platform = ?";
    params.push(platform);
  }

   if (currency_code) {
        whereQuery += " AND pr.currency_code = ?";
        params.push(currency_code);
    }

  if (is_active !== null && is_active !== undefined) {
    whereQuery += " AND pr.is_active = ?";
    params.push(is_active);
  }

  const countQuery = `
        SELECT COUNT(*) AS total
        FROM ad_pricing_rules pr
        LEFT JOIN ad_objectives ao
            ON ao.id = pr.objective_id
        LEFT JOIN ad_types at
            ON at.id = pr.ad_type_id
        LEFT JOIN ad_subtypes ast
            ON ast.id = pr.ad_subtype_id
        ${whereQuery}
    `;

  const [countRows] = await pool.execute(countQuery, params);
  const total = Number(countRows[0].total);

  const listQuery = `
        ${getPricingRuleSelectQuery()}
        ${whereQuery}
        ORDER BY pr.created_at DESC, pr.id DESC
        LIMIT ? OFFSET ?
    `;

  const [rows] = await pool.execute(listQuery, [...params, pageSize, offset]);

  return {
    data: rows,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getPricingRuleById = async (id) => {
  const query = `
        ${getPricingRuleSelectQuery()}
        WHERE pr.id = ?
        LIMIT 1
    `;

  const [rows] = await pool.execute(query, [id]);

  return rows[0] || null;
};

export const updatePricingRule = async (id, data) => {
  const existingRule = await getPricingRuleById(id);

  if (!existingRule) {
    return false;
  }

  const normalizedData = normalizePricingRuleData(data);

  validateCurrencyCountry(normalizedData);
  await validateReferences(normalizedData);

  if (Number(existingRule.is_active) === 1) {
    await checkPricingRuleOverlap({
      ...normalizedData,
      exclude_id: id,
    });
  }

  const {
    objective_id,
    ad_type_id,
    ad_subtype_id,
    billing_model,
    country_code,
    admin_area_1,
    city,
    platform,
    currency_code,
    rate,
    effective_from,
    effective_until = null,
  } = normalizedData;

  await pool.execute(
    `UPDATE ad_pricing_rules
         SET
            objective_id = ?,
            ad_type_id = ?,
            ad_subtype_id = ?,
            billing_model = ?,
            country_code = ?,
            admin_area_1 = ?,
            city = ?,
            platform = ?,
            currency_code = ?,
            rate = ?,
            effective_from = ?,
            effective_until = ?
         WHERE id = ?`,
    [
      objective_id,
      ad_type_id,
      ad_subtype_id,
      billing_model,
      country_code,
      admin_area_1,
      city,
      platform,
      currency_code,
      rate,
      effective_from,
      effective_until,
      id,
    ],
  );

  return true;
};

export const updatePricingRuleStatus = async (id, is_active) => {
  const rule = await getPricingRuleById(id);

  if (!rule) {
    return false;
  }

  if (Number(is_active) === 1) {
    await checkPricingRuleOverlap({
      ...rule,
      exclude_id: id,
    });
  }

  await pool.execute(
    `UPDATE ad_pricing_rules
         SET is_active = ?
         WHERE id = ?`,
    [is_active, id],
  );

  return true;
};
