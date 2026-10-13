import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pool from "../configs/database/db.js";
import businessDetailModel from "../models/businessDetailModel.js";

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
    "tax_id",
    "tax_id_type",
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

const businessDetailService = {
  async getCountryConfiguration() {
    return getCountries();
  },

  async getCountryConfigurationByCode(countryCode) {
    const country = validateCountry(countryCode.toUpperCase());
    return country;
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
