import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pool from "../configs/database/db.js";
import businessDetailModel from "../models/businessDetailModel.js";
import { getAllCountryCurrencies, getCurrencyByCountryCode, isCashfreeCurrencySupported } from "../utils/currencyConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const countriesPath = path.resolve(
  __dirname,
  "../configs/json/countries_details.json",
);

let countriesCache = null;

function getCountries() {
  if (!countriesCache) {
    const fileContents = fs.readFileSync(countriesPath, "utf8");
    countriesCache = JSON.parse(fileContents);
  }

  return countriesCache.countries || [];
}

function normalizeOptionalFields(data) {
  const normalized = { ...data };

  for (const field of [
    "email",
    "admin_area_1",
    "admin_area_2",
    "city",
    "area",
    "postal_code",
    "tax_id"
  ]) {
    if (normalized[field] === "") {
      normalized[field] = null;
    }
  }

  if (normalized.country_code) {
    normalized.country_code = normalized.country_code.toUpperCase();
  }

  return normalized;
}

function validateCountry(countryCode) {
  const country = getCountries().find(
    (item) => item.country_code === countryCode,
  );

  if (!country) {
    const error = new Error("Invalid or unsupported country code.");
    error.statusCode = 400;
    throw error;
  }

  return country;
}

function validateCountryAddressFields(country, data) {
  const allowedFields = new Set(
    (country.fields || []).map((field) => field.value),
  );

  const addressFields = [
    "admin_area_1",
    "admin_area_2",
    "city",
    "area",
    "postal_code",
  ];

  for (const field of addressFields) {
    if (data[field] && !allowedFields.has(field)) {
      const error = new Error(
        `${field} is not configured for ${country.country_name}.`,
      );
      error.statusCode = 400;
      throw error;
    }
  }
}


async function getAllCountryTaxMetadata() {
  const [rows] = await pool.execute(
    `SELECT country_code, admin_area_1, tax_name, tax_id_label,
            tax_rate, platform_fee_rate, tax_basis
     FROM country_tax_rules
     WHERE admin_area_1 IS NULL AND is_active = 1 AND effective_from <= UTC_TIMESTAMP()
       AND (effective_until IS NULL OR effective_until >= UTC_TIMESTAMP())
     ORDER BY country_code, (admin_area_1 IS NOT NULL) DESC, effective_from DESC, id DESC`,
  );
  const byCountry = new Map();
  for (const row of rows) {
    if (!byCountry.has(row.country_code)) byCountry.set(row.country_code, row);
  }
  return byCountry;
}

async function getCountryTaxMetadata(countryCode) {
  const [rows] = await pool.execute(
    `SELECT tax_name, tax_id_label, tax_rate, platform_fee_rate, tax_basis
     FROM country_tax_rules
     WHERE country_code = ? AND admin_area_1 IS NULL AND is_active = 1
       AND effective_from <= UTC_TIMESTAMP()
       AND (effective_until IS NULL OR effective_until >= UTC_TIMESTAMP())
     ORDER BY (admin_area_1 IS NOT NULL) DESC, effective_from DESC, id DESC
     LIMIT 1`,
    [countryCode],
  );
  const rule = rows[0];
  return rule ? {
    configured: true,
    tax_name: rule.tax_name,
    tax_id_label: rule.tax_id_label,
    tax_id_required: false,
    tax_rate: Number(rule.tax_rate),
    platform_fee_rate: Number(rule.platform_fee_rate),
    tax_basis: rule.tax_basis,
  } : { configured: false, tax_id_label: null, tax_id_required: false, tax_rate: null, platform_fee_rate: null, tax_basis: "base_ad_spend" };
}

const businessDetailService = {
  async getCountryConfiguration() {
    const currencies = new Map(
      getAllCountryCurrencies().map((item) => [item.country_code, item]),
    );
    const taxByCountry = await getAllCountryTaxMetadata();
    return getCountries().map((country) => {
      const currency = currencies.get(country.country_code) || null;
      const taxRule = taxByCountry.get(country.country_code);
      return {
        ...country,
        currency: currency ? {
          currency_code: currency.currency_code,
          currency_symbol: currency.currency_symbol,
          currency_name: currency.currency_name,
          currency_decimal_places: currency.currency_decimal_places,
          cashfree_supported: currency.cashfree_supported,
        } : null,
        tax: taxRule ? {
          configured: true,
          tax_name: taxRule.tax_name,
          tax_id_label: taxRule.tax_id_label,
          tax_id_required: false,
          tax_rate: Number(taxRule.tax_rate),
          platform_fee_rate: Number(taxRule.platform_fee_rate),
          tax_basis: taxRule.tax_basis,
        } : { configured: false, tax_id_label: null, tax_id_required: false, tax_rate: null, platform_fee_rate: null, tax_basis: "base_ad_spend" },
      };
    });
  },

  async getCountryConfigurationByCode(countryCode) {
    const country = validateCountry(countryCode.toUpperCase());
    const currency = getCurrencyByCountryCode(country.country_code);
    return {
      ...country,
      currency: currency ? {
        currency_code: currency.currency_code,
        currency_symbol: currency.currency_symbol,
        currency_name: currency.currency_name,
        currency_decimal_places: Number(currency.currency_decimal_places ?? 2),
        cashfree_supported: isCashfreeCurrencySupported(currency.currency_code),
      } : null,
      tax: await getCountryTaxMetadata(country.country_code),
    };
  },

  async createBusiness(userId, payload) {
    const data = normalizeOptionalFields(payload);
    const country = validateCountry(data.country_code);

    validateCountryAddressFields(country, data);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const businessId = await businessDetailModel.create(connection, {
        ...data,
        user_id: userId,
      });

      const business = await businessDetailModel.findById(
        businessId,
        userId,
        connection,
      );

      await connection.commit();

      return business;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getBusinesses(userId) {
    return businessDetailModel.findByUserId(userId);
  },

  async getBusinessById(userId, businessId) {
    const business = await businessDetailModel.findById(businessId, userId);

    if (!business) {
      const error = new Error("Business not found.");
      error.statusCode = 404;
      throw error;
    }

    return business;
  },

  async updateBusiness(userId, businessId, payload) {
    const data = normalizeOptionalFields(payload);
    const existing = await businessDetailModel.findById(businessId, userId);

    if (!existing) {
      const error = new Error("Business not found.");
      error.statusCode = 404;
      throw error;
    }

    const merged = {
      ...existing,
      ...data,
    };

    const country = validateCountry(merged.country_code);

    validateCountryAddressFields(country, merged);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await businessDetailModel.update(connection, businessId, userId, data);

      const updatedBusiness = await businessDetailModel.findById(
        businessId,
        userId,
        connection,
      );

      await connection.commit();

      return updatedBusiness;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async selectBusiness(userId, businessId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await businessDetailModel.findById(
        businessId,
        userId,
        connection,
      );

      if (!existing) {
        const error = new Error("Business not found.");
        error.statusCode = 404;
        throw error;
      }

      await businessDetailModel.select(connection, businessId, userId);

      const business = await businessDetailModel.findById(
        businessId,
        userId,
        connection,
      );

      await connection.commit();

      return business;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async deleteBusiness(userId, businessId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await businessDetailModel.findById(
        businessId,
        userId,
        connection,
      );

      if (!existing) {
        const error = new Error("Business not found.");
        error.statusCode = 404;
        throw error;
      }

      await businessDetailModel.delete(connection, businessId, userId);

      await connection.commit();

      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default businessDetailService;
