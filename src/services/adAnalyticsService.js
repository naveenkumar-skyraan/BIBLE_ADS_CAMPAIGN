import { processAdAnalyticsBatch } from "../models/adAnalyticsModel.js";

const RETRYABLE_DATABASE_ERRORS = new Set([
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
]);

export const submitAdAnalyticsBatch = async (payload) => {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await processAdAnalyticsBatch(payload);
    } catch (error) {
      lastError = error;

      if (
        !RETRYABLE_DATABASE_ERRORS.has(error.code) ||
        attempt === 3
      ) {
        throw error;
      }
    }
  }

  throw lastError;
};