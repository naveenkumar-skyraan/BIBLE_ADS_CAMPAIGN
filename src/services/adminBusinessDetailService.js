import pool from "../configs/database/db.js";
import businessDetailModel from "../models/businessDetailModel.js";

import { getListingData } from "../helpers/listingHelper.js";

export const getAllAdminBusinesses = async ({
  page = 1,
  limit = 10,
  search = "",
  verification_status = null,
} = {}) => {
  return await getListingData({
    page,
    limit,
    search,
    filters: {
      verification_status,
    },

    getData: ({ search, filters, limit, offset }) =>
      businessDetailModel.getAdminBusinesses({
        search,
        verification_status: filters.verification_status,
        limit,
        offset,
      }),

    getCount: (search, filters) =>
      businessDetailModel.getAdminBusinessesCount({
        search,
        verification_status: filters.verification_status,
      }),
  });
};

export const getAdminBusinessById = async (id) => {
  const business = await businessDetailModel.getAdminBusinessById(id);

  if (!business) {
    const error = new Error("Business details not found.");
    error.statusCode = 404;
    throw error;
  }

  return business;
};

export const changeBusinessVerificationStatus = async (
  id,
  newStatus,
  adminId,
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, verification_status
             FROM business_details
             WHERE id = ?
               AND is_deleted = 0
             LIMIT 1
             FOR UPDATE`,
      [id],
    );

    if (rows.length === 0) {
      const error = new Error("Business details not found.");
      error.statusCode = 404;
      throw error;
    }

    const currentStatus = rows[0].verification_status;

    const allowedTransitions = {
      pending: ["contacted"],
      contacted: ["approved-closed", "rejected-closed"],
      "approved-closed": [],
      "rejected-closed": [],
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      const error = new Error(
        `Cannot change status from "${currentStatus}" to "${newStatus}".`,
      );

      error.statusCode = 400;
      throw error;
    }

    await connection.execute(
      `UPDATE business_details
   SET verification_status = ?,
       verified_by = ?,
       verified_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
   WHERE id = ?
     AND is_deleted = 0`,
      [newStatus, adminId, id],
    );
    await connection.commit();

    return await getAdminBusinessById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateAdminBusinessDetails = async (id, data) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, verification_status
             FROM business_details
             WHERE id = ?
               AND is_deleted = 0
             LIMIT 1
             FOR UPDATE`,
      [id],
    );

    if (rows.length === 0) {
      const error = new Error("Business details not found.");
      error.statusCode = 404;
      throw error;
    }

    if (rows[0].verification_status !== "contacted") {
      const error = new Error(
        "Business details can only be edited while the status is contacted.",
      );

      error.statusCode = 400;
      throw error;
    }

    const updated = await businessDetailModel.updateAdminBusinessDetails(
      connection,
      id,
      data,
    );

    if (!updated) {
      const error = new Error("No business details were updated.");
      error.statusCode = 400;
      throw error;
    }

    await connection.commit();

    return await getAdminBusinessById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
