import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pool from "../configs/database/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const countriesPath = path.resolve(
  __dirname,
  "../configs/json/countries_details.json",
);

const GEONAMES_BASE_URL = "https://secure.geonames.org";
const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME;

const PAGE_SIZE = 1000;
const MAX_RECORDS = 5000;
const INSERT_BATCH_SIZE = 200;

const LOCATION_FIELDS = new Set([
  "admin_area_1",
  "admin_area_2",
  "city",
  "area",
]);

const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

let countriesCache = null;

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getCountries() {
  if (!countriesCache) {
    const contents = fs.readFileSync(countriesPath, "utf8");
    const parsed = JSON.parse(contents);

    countriesCache = Array.isArray(parsed.countries) ? parsed.countries : [];
  }

  return countriesCache;
}

function getCountryConfiguration(countryCode) {
  return getCountries().find((country) => country.country_code === countryCode);
}

function validateCountry(countryCode) {
  if (typeof countryCode !== "string" || !countryCode.trim()) {
    throw createError("Query parameter 'country_code' is required.", 400);
  }

  const normalized = countryCode.trim().toUpperCase();

  if (!getCountryConfiguration(normalized)) {
    throw createError("Invalid or unsupported country code.", 400);
  }

  return normalized;
}

function getConfiguredLocationFields(configuration) {
  return (configuration.fields || [])
    .map((item) => item.value)
    .filter((key) => key !== "postal_code" && LOCATION_FIELDS.has(key));
}

function validateLocationField(countryCode, fieldKey) {
  const configuration = getCountryConfiguration(countryCode);

  if (!configuration) {
    throw createError("Invalid or unsupported country code.", 400);
  }

  const configured = (configuration.fields || []).some(
    (item) => item.value === fieldKey,
  );

  if (!configured) {
    throw createError(
      `Field '${fieldKey}' is not configured for ${countryCode}.`,
      400,
    );
  }

  if (fieldKey === "postal_code") {
    throw createError("Postal code is a manual-entry field.", 400);
  }

  if (!LOCATION_FIELDS.has(fieldKey)) {
    throw createError(
      `Location lookup is not supported for '${fieldKey}'.`,
      400,
    );
  }
}

function getParentFieldKey(configuration, fieldKey) {
  const fields = getConfiguredLocationFields(configuration);
  const index = fields.indexOf(fieldKey);

  return index > 0 ? fields[index - 1] : null;
}

function getNextFieldKey(configuration, fieldKey) {
  const fields = getConfiguredLocationFields(configuration);
  const index = fields.indexOf(fieldKey);

  return index >= 0 && index < fields.length - 1 ? fields[index + 1] : null;
}

function parseJson(value) {
  if (typeof value === "string") {
    return JSON.parse(value);
  }

  return value;
}

function getPayload(record) {
  try {
    return parseJson(record?.provider_payload) ?? null;
  } catch {
    return null;
  }
}

const LOCATION_NAME_OVERRIDES = new Map();

function convertLocationName(recordOrName) {
  const record =
    typeof recordOrName === "string"
      ? { name: recordOrName }
      : recordOrName || {};

  const geonameId = String(
    record.geonameId ?? record.geoname_id ?? record.provider_location_id ?? "",
  );

  const override = LOCATION_NAME_OVERRIDES.get(geonameId);

  if (override) {
    return override;
  }

  const rawName = String(record.name || record.toponymName || "");

  const isLatinName = /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}]+$/u.test(
    rawName,
  );

  const normalizedName = isLatinName
    ? rawName.normalize("NFKD").replace(/\p{M}/gu, "")
    : rawName;

  return normalizedName
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u2018\u2019\u02BC`´]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function getRecordName(record) {
  return convertLocationName(record);
}

function getGeoNamesId(record) {
  const id = record?.geonameId ?? record?.geoname_id;

  if (id === undefined || id === null || !/^\d+$/.test(String(id))) {
    return null;
  }

  return String(id);
}

function getFeatureCode(record) {
  return String(record?.fcode || "").toUpperCase();
}

function getFeatureClass(record) {
  return String(record?.fcl || getFeatureCode(record).charAt(0)).toUpperCase();
}

function isValidProviderRecord(record, countryCode) {
  if (!getGeoNamesId(record) || !getRecordName(record)) {
    return false;
  }

  if (
    record.countryCode &&
    String(record.countryCode).toUpperCase() !== countryCode
  ) {
    return false;
  }

  return true;
}

function sortProviderRecords(records) {
  const seen = new Set();
  const result = [];

  for (const record of records || []) {
    const id = getGeoNamesId(record);

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(record);
  }

  return result.sort((a, b) =>
    collator.compare(getRecordName(a), getRecordName(b)),
  );
}

function sortOptions(options) {
  return [...options].sort((a, b) => collator.compare(a.name, b.name));
}

function uniqueOptionsByGeoNamesId(options) {
  const seen = new Set();

  return sortOptions(
    options.filter((option) => {
      const key = String(option.geoname_id || option.id);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }),
  );
}

function ensureGeoNamesUsername() {
  if (!GEONAMES_USERNAME) {
    throw createError(
      "GEONAMES_USERNAME is not configured in the environment.",
      500,
    );
  }
}

async function requestGeoNames(endpoint, query = {}) {
  ensureGeoNamesUsername();

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  params.set("username", GEONAMES_USERNAME);

  console.log(
    `[GEONAMES API HIT] ${endpoint}`,
    Object.fromEntries(
      [...params.entries()].filter(([key]) => key !== "username"),
    ),
  );

  let response;
  let result;

  try {
    response = await fetch(
      `${GEONAMES_BASE_URL}/${endpoint}?${params.toString()}`,
    );

    result = await response.json();
  } catch {
    throw createError("Unable to connect to GeoNames.", 502);
  }

  if (!response.ok || result?.status) {
    throw createError(
      result?.status?.message || "GeoNames location request failed.",
      502,
    );
  }

  return result;
}

async function searchGeoNames(query) {
  const records = [];

  for (let startRow = 0; startRow < MAX_RECORDS; startRow += PAGE_SIZE) {
    const result = await requestGeoNames("searchJSON", {
      ...query,
      maxRows: PAGE_SIZE,
      startRow,
      style: "FULL",
    });

    const page = result.geonames || [];
    records.push(...page);

    const total = Number(result.totalResultsCount ?? records.length);

    if (
      page.length === 0 ||
      records.length >= total ||
      page.length < PAGE_SIZE
    ) {
      break;
    }
  }

  return records;
}

async function getGeoNamesChildren(geonameId) {
  const records = [];

  for (let startRow = 0; startRow < MAX_RECORDS; startRow += PAGE_SIZE) {
    const result = await requestGeoNames("childrenJSON", {
      geonameId,
      maxRows: PAGE_SIZE,
      startRow,
      style: "FULL",
    });

    const page = result.geonames || [];
    records.push(...page);

    const total = Number(result.totalResultsCount ?? records.length);

    if (
      page.length === 0 ||
      records.length >= total ||
      page.length < PAGE_SIZE
    ) {
      break;
    }
  }

  return records;
}

async function getGeoNamesDetails(geonameId) {
  const result = await requestGeoNames("getJSON", {
    geonameId,
    style: "FULL",
  });

  return result.geoname || result;
}

function getAdminCodes(record) {
  const codes = {};

  for (const key of ["adminCode1", "adminCode2", "adminCode3", "adminCode4"]) {
    const value = record?.[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      codes[key] = String(value).trim();
    }
  }

  return codes;
}

function buildAdminCodeQuery(metadata, parentFieldKey) {
  const codes = getAdminCodes(metadata);

  const requiredKeys = {
    admin_area_1: ["adminCode1"],
    admin_area_2: ["adminCode1", "adminCode2"],
    city: ["adminCode1", "adminCode2", "adminCode3"],
  }[parentFieldKey];

  if (!requiredKeys || !requiredKeys.every((key) => codes[key])) {
    return null;
  }

  return Object.fromEntries(requiredKeys.map((key) => [key, codes[key]]));
}

function filterRecordsForField(records, countryCode, fieldKey, options = {}) {
  const validRecords = (records || []).filter((record) =>
    isValidProviderRecord(record, countryCode),
  );

  if (fieldKey === "admin_area_1") {
    return sortProviderRecords(
      validRecords.filter((record) => getFeatureCode(record) === "ADM1"),
    );
  }

  if (fieldKey === "admin_area_2") {
    return sortProviderRecords(
      validRecords.filter((record) => getFeatureCode(record) === "ADM2"),
    );
  }

  if (fieldKey === "city") {
    if (options.preferAdminArea3) {
      return sortProviderRecords(
        validRecords.filter((record) => getFeatureCode(record) === "ADM3"),
      );
    }

    return sortProviderRecords(
      validRecords.filter(
        (record) =>
          getFeatureClass(record) === "P" && getFeatureCode(record) !== "PPLX",
      ),
    );
  }

  if (fieldKey === "area") {
    return sortProviderRecords(
      validRecords.filter((record) => getFeatureClass(record) === "P"),
    );
  }

  return [];
}

async function fetchRootRecords(countryCode, fieldKey) {
  let query;

  if (fieldKey === "admin_area_1") {
    query = {
      country: countryCode,
      featureCode: "ADM1",
    };
  } else if (fieldKey === "admin_area_2") {
    query = {
      country: countryCode,
      featureCode: "ADM2",
    };
  } else if (fieldKey === "city") {
    query = {
      country: countryCode,
      featureClass: "P",
    };
  } else {
    throw createError("This location field requires a selected parent.", 400);
  }

  const records = await searchGeoNames(query);

  return filterRecordsForField(records, countryCode, fieldKey);
}

async function fetchChildRecords({
  countryCode,
  fieldKey,
  parentFieldKey,
  nextFieldKey,
  parentRecord,
}) {
  const parentGeoNamesId = parentRecord.provider_location_id;

  if (!parentGeoNamesId) {
    throw createError("The selected parent has no GeoNames ID.", 422);
  }

  if (fieldKey === "area") {
    return filterRecordsForField(
      await getGeoNamesChildren(parentGeoNamesId),
      countryCode,
      "area",
    );
  }

  const preferAdminArea3 =
    fieldKey === "city" &&
    parentFieldKey === "admin_area_2" &&
    nextFieldKey === "area";

  const directChildren = await getGeoNamesChildren(parentGeoNamesId);

  const matchedRecords = filterRecordsForField(
    directChildren,
    countryCode,
    fieldKey,
    { preferAdminArea3 },
  );

  if (matchedRecords.length > 0) {
    return matchedRecords;
  }

  let parentMetadata;

  try {
    parentMetadata = await getGeoNamesDetails(parentGeoNamesId);
  } catch {
    return [];
  }

  const adminCodeQuery = buildAdminCodeQuery(parentMetadata, parentFieldKey);

  if (!adminCodeQuery) {
    return [];
  }

  if (fieldKey === "admin_area_2") {
    const records = await searchGeoNames({
      country: countryCode,
      featureCode: "ADM2",
      ...adminCodeQuery,
    });

    return filterRecordsForField(records, countryCode, fieldKey);
  }

  if (fieldKey === "city" && preferAdminArea3) {
    const records = await searchGeoNames({
      country: countryCode,
      featureCode: "ADM3",
      ...adminCodeQuery,
    });

    return filterRecordsForField(records, countryCode, fieldKey, {
      preferAdminArea3: true,
    });
  }

  if (fieldKey === "city") {
    const records = await searchGeoNames({
      country: countryCode,
      featureClass: "P",
      ...adminCodeQuery,
    });

    return filterRecordsForField(records, countryCode, fieldKey);
  }

  return [];
}

async function readLocationRows(countryCode, fieldKey, parentId) {
  const [rows] = await pool.execute(
    `SELECT
        id,
        country_code,
        field_key,
        name,
        parent_id,
        provider_location_id,
        provider_payload
     FROM locations
     WHERE country_code = ?
       AND field_key = ?
       AND parent_id <=> ?
     ORDER BY name ASC, id ASC`,
    [countryCode, fieldKey, parentId],
  );

  for (const row of rows) {
    const normalizedName = convertLocationName({
      geonameId: row.provider_location_id,
      name: row.name,
    });

    if (normalizedName && normalizedName !== row.name) {
      await pool.execute("UPDATE locations SET name = ? WHERE id = ?", [
        normalizedName,
        row.id,
      ]);

      row.name = normalizedName;
    }
  }

  return rows.sort((a, b) => collator.compare(a.name, b.name));
}

function rowToOption(row) {
  const adminTypes = {
    admin_area_1: "administrative_division",
    admin_area_2: "district",
    city: "city",
  };

  return {
    id: Number(row.id),
    name: row.name,
    display_name: row.name,
    field_key: row.field_key,
    parent_id: row.parent_id === null ? null : Number(row.parent_id),
    geoname_id: row.provider_location_id
      ? Number(row.provider_location_id)
      : null,
    admin_type: adminTypes[row.field_key] || "administrative_division",
  };
}

function payloadToAreaOptions(payload, parentRecord) {
  const seen = new Set();
  const options = [];

  for (const item of payload || []) {
    if (
      !item ||
      item.geonameId === undefined ||
      item.geonameId === null ||
      !item.name
    ) {
      continue;
    }

    const geonameId = String(item.geonameId);

    if (!/^\d+$/.test(geonameId) || seen.has(geonameId)) {
      continue;
    }

    seen.add(geonameId);

    const name = convertLocationName(item);

    options.push({
      id: Number(geonameId),
      name,
      display_name: name,
      field_key: "area",
      parent_id: Number(parentRecord.id),
      geoname_id: Number(geonameId),
      admin_type: "area",
    });
  }

  return sortOptions(options);
}

async function saveLocationRecords({
  countryCode,
  fieldKey,
  parentId,
  records,
}) {
  const normalizedRecords = sortProviderRecords(
    records.filter((record) => getGeoNamesId(record) && getRecordName(record)),
  );

  if (normalizedRecords.length === 0) {
    return;
  }

  for (
    let offset = 0;
    offset < normalizedRecords.length;
    offset += INSERT_BATCH_SIZE
  ) {
    const batch = normalizedRecords.slice(offset, offset + INSERT_BATCH_SIZE);

    const values = [];

    const placeholders = batch.map((record) => {
      values.push(
        countryCode,
        fieldKey,
        getRecordName(record),
        parentId,
        getGeoNamesId(record),
      );

      return "(?, ?, ?, ?, ?)";
    });

    await pool.execute(
      `INSERT INTO locations
        (
          country_code,
          field_key,
          name,
          parent_id,
          provider_location_id
        )
       VALUES ${placeholders.join(", ")}
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         parent_id = VALUES(parent_id)`,
      values,
    );
  }
}

async function storeChildrenPayload(parentRecord, childRecords) {
  const payload = sortProviderRecords(childRecords).map((record) => ({
    geonameId: Number(getGeoNamesId(record)),
    name: getRecordName(record),
  }));

  await pool.execute(
    `UPDATE locations
     SET provider_payload = ?
     WHERE id = ?
       AND country_code = ?`,
    [JSON.stringify(payload), parentRecord.id, parentRecord.country_code],
  );

  return payload;
}

async function normalizeChildrenPayload(parentRecord, payload) {
  const normalizedPayload = sortProviderRecords(
    (payload || [])
      .filter(
        (item) =>
          item && (item.geonameId ?? item.geoname_id) != null && item.name,
      )
      .map((item) => ({
        geonameId: String(item.geonameId ?? item.geoname_id),
        name: convertLocationName(item),
      })),
  ).map((item) => ({
    geonameId: Number(getGeoNamesId(item)),
    name: getRecordName(item),
  }));

  if (JSON.stringify(payload) !== JSON.stringify(normalizedPayload)) {
    await pool.execute(
      `UPDATE locations
       SET provider_payload = ?
       WHERE id = ?
         AND country_code = ?`,
      [
        JSON.stringify(normalizedPayload),
        parentRecord.id,
        parentRecord.country_code,
      ],
    );
  }

  return normalizedPayload;
}

async function readChildrenFromPayload({
  countryCode,
  fieldKey,
  parentRecord,
  payload,
}) {
  const childRecords = sortProviderRecords(
    (payload || [])
      .filter(
        (item) =>
          item &&
          item.geonameId !== undefined &&
          item.geonameId !== null &&
          item.name,
      )
      .map((item) => ({
        geonameId: String(item.geonameId),
        name: String(item.name),
        countryCode,
      })),
  );

  await saveLocationRecords({
    countryCode,
    fieldKey,
    parentId: Number(parentRecord.id),
    records: childRecords,
  });

  const rows = await readLocationRows(
    countryCode,
    fieldKey,
    Number(parentRecord.id),
  );

  const ids = new Set(childRecords.map(getGeoNamesId));

  return uniqueOptionsByGeoNamesId(
    rows
      .filter((row) => ids.has(String(row.provider_location_id)))
      .map(rowToOption),
  );
}

async function getChildrenOptions({
  countryCode,
  fieldKey,
  parentFieldKey,
  nextFieldKey,
  parentRecord,
}) {
  const existingPayload = getPayload(parentRecord);

  if (Array.isArray(existingPayload)) {
    console.log(
      `[LOCATION SOURCE: MYSQL PAYLOAD] ${countryCode} ${fieldKey} parent_id=${parentRecord.id}`,
    );

    const normalizedPayload = await normalizeChildrenPayload(
      parentRecord,
      existingPayload,
    );

    if (fieldKey === "area") {
      return payloadToAreaOptions(normalizedPayload, parentRecord);
    }

    return readChildrenFromPayload({
      countryCode,
      fieldKey,
      parentRecord,
      payload: normalizedPayload,
    });
  }

  if (existingPayload !== null && !Array.isArray(existingPayload)) {
    await pool.execute(
      `UPDATE locations
       SET provider_payload = NULL
       WHERE id = ?
         AND country_code = ?`,
      [parentRecord.id, countryCode],
    );
  }

  console.log(
    `[LOCATION SOURCE: GEONAMES] ${countryCode} ${fieldKey} parent_id=${parentRecord.id}`,
  );

  const providerRecords = await fetchChildRecords({
    countryCode,
    fieldKey,
    parentFieldKey,
    nextFieldKey,
    parentRecord,
  });

  const storedPayload = await storeChildrenPayload(
    parentRecord,
    providerRecords,
  );

  if (fieldKey === "area") {
    return payloadToAreaOptions(storedPayload, parentRecord);
  }

  await saveLocationRecords({
    countryCode,
    fieldKey,
    parentId: Number(parentRecord.id),
    records: providerRecords,
  });

  const rows = await readLocationRows(
    countryCode,
    fieldKey,
    Number(parentRecord.id),
  );

  const providerIds = new Set(providerRecords.map(getGeoNamesId));

  return uniqueOptionsByGeoNamesId(
    rows
      .filter((row) => providerIds.has(String(row.provider_location_id)))
      .map(rowToOption),
  );
}

const locationService = {
  async getOptions({ country_code, field, parent_id }) {
    const normalizedCountryCode = validateCountry(country_code);
    const fieldKey = String(field || "").trim();

    validateLocationField(normalizedCountryCode, fieldKey);

    const configuration = getCountryConfiguration(normalizedCountryCode);

    const parentFieldKey = getParentFieldKey(configuration, fieldKey);

    const nextFieldKey = getNextFieldKey(configuration, fieldKey);

    let parentRecord = null;

    if (fieldKey === "area" && !parentFieldKey) {
      throw createError("Area options require a selected city.", 400);
    }

    if (parentFieldKey) {
      if (parent_id === undefined || parent_id === null || parent_id === "") {
        throw createError(
          `Query parameter 'parent_id' is required for '${fieldKey}'.`,
          400,
        );
      }

      const parentId = Number(parent_id);

      if (!Number.isSafeInteger(parentId) || parentId <= 0) {
        throw createError(
          "parent_id must be a positive internal locations.id.",
          400,
        );
      }

      const [parentRows] = await pool.execute(
        `SELECT
            id,
            country_code,
            field_key,
            name,
            parent_id,
            provider_location_id,
            provider_payload
         FROM locations
         WHERE id = ?
           AND country_code = ?
           AND field_key = ?
         LIMIT 1`,
        [parentId, normalizedCountryCode, parentFieldKey],
      );

      if (parentRows.length === 0) {
        throw createError(
          `Parent location was not found for field '${fieldKey}'.`,
          404,
        );
      }

      parentRecord = parentRows[0];

      if (!parentRecord.provider_location_id) {
        throw createError("The selected parent has no GeoNames ID.", 422);
      }
    } else if (
      parent_id !== undefined &&
      parent_id !== null &&
      parent_id !== ""
    ) {
      throw createError(
        `Do not provide parent_id for the first location field '${fieldKey}'.`,
        400,
      );
    }

    if (!parentRecord) {
      const cachedRows = await readLocationRows(
        normalizedCountryCode,
        fieldKey,
        null,
      );

      if (cachedRows.length > 0) {
        console.log(
          `[LOCATION SOURCE: MYSQL] ${normalizedCountryCode} ${fieldKey}`,
        );

        return uniqueOptionsByGeoNamesId(cachedRows.map(rowToOption));
      }

      console.log(
        `[LOCATION SOURCE: GEONAMES] ${normalizedCountryCode} ${fieldKey}`,
      );

      const providerRecords = await fetchRootRecords(
        normalizedCountryCode,
        fieldKey,
      );

      await saveLocationRecords({
        countryCode: normalizedCountryCode,
        fieldKey,
        parentId: null,
        records: providerRecords,
      });

      const savedRows = await readLocationRows(
        normalizedCountryCode,
        fieldKey,
        null,
      );

      const providerIds = new Set(providerRecords.map(getGeoNamesId));

      return uniqueOptionsByGeoNamesId(
        savedRows
          .filter((row) => providerIds.has(String(row.provider_location_id)))
          .map(rowToOption),
      );
    }

    return getChildrenOptions({
      countryCode: normalizedCountryCode,
      fieldKey,
      parentFieldKey,
      nextFieldKey,
      parentRecord,
    });
  },
};

export default locationService;
