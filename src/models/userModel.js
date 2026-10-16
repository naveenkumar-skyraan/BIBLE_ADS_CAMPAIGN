import pool from "../configs/database/db.js";

export const findUserByPhone = async (phone) => {
  const [rows] = await pool.execute(
    `SELECT
            id,
            name,
            phone,
            email,
            password_hash,
            is_phone_verified,
            otp,
            otp_expires_at,
            otp_purpose,
            refresh_token,
            refresh_token_expires_at,
            created_at,
            updated_at,
            is_account_deleted,
            account_deleted_at
        FROM users
        WHERE phone = ?
        LIMIT 1`,
    [phone],
  );

  return rows[0] || null;
};

export const findUserById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
            id,
            name,
            phone,
            email,
            password_hash,
            is_phone_verified,
            otp,
            otp_expires_at,
            otp_purpose,
            refresh_token,
            refresh_token_expires_at,
            created_at,
            updated_at,
            is_account_deleted,
            account_deleted_at
        FROM users
        WHERE id = ?
        LIMIT 1`,
    [id],
  );

  return rows[0] || null;
};

export const createUser = async ({
  name,
  phone = "",
  email = "",
  passwordHash = "",
  otp = "",
  otpExpiresAt = "",
  otpPurpose = "",
  isOauthLogin = 0,
  oauthProviderId = "",
  oauthProvider = 0,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO users
      (
        name,
        phone,
        email,
        password_hash,
        is_phone_verified,
        otp,
        otp_expires_at,
        otp_purpose,
        is_oauth_login,
        oauth_provider_id,
        oauth_provider
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      phone || "",
      email || "",
      passwordHash || "",
      0,
      otp || "",
      otpExpiresAt || "",
      otpPurpose || "",
      isOauthLogin,
      oauthProviderId || "",
      oauthProvider,
    ],
  );

  return result.insertId;
};

export const updateOtp = async ({ userId, otp, otpExpiresAt, otpPurpose }) => {
  await pool.execute(
    `UPDATE users
        SET
            otp = ?,
            otp_expires_at = ?,
            otp_purpose = ?
        WHERE id = ?`,
    [otp, otpExpiresAt, otpPurpose, userId],
  );
};

export const verifyPhone = async (userId) => {
  await pool.execute(
    `UPDATE users
        SET
            is_phone_verified = 1,
            otp = NULL,
            otp_expires_at = NULL,
            otp_purpose = NULL
        WHERE id = ?`,
    [userId],
  );
};

export const clearOtp = async (userId) => {
  await pool.execute(
    `UPDATE users
        SET
            otp = NULL,
            otp_expires_at = NULL,
            otp_purpose = NULL
        WHERE id = ?`,
    [userId],
  );
};

export const updatePassword = async (userId, passwordHash) => {
  await pool.execute(
    `UPDATE users
        SET
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
    [passwordHash, userId],
  );
};

export const updateRefreshToken = async ({
  userId,
  refreshToken,
  refreshTokenExpiresAt,
}) => {
  await pool.execute(
    `UPDATE users
        SET
            refresh_token = ?,
            refresh_token_expires_at = ?
        WHERE id = ?`,
    [refreshToken, refreshTokenExpiresAt, userId],
  );
};

export const clearRefreshToken = async (userId) => {
  await pool.execute(
    `UPDATE users
        SET
            refresh_token = NULL,
            refresh_token_expires_at = NULL
        WHERE id = ?`,
    [userId],
  );
};

export const markAccountForDeletion = async (userId) => {
  await pool.execute(
    `UPDATE users
        SET
            is_account_deleted = 1,
            account_deleted_at = CURRENT_TIMESTAMP,
            refresh_token = NULL,
            refresh_token_expires_at = NULL
        WHERE id = ?`,
    [userId],
  );
};

export const reactivateAccount = async (userId) => {
  await pool.execute(
    `UPDATE users
        SET
            is_account_deleted = 0,
            account_deleted_at = NULL
        WHERE id = ?`,
    [userId],
  );
};

export const permanentlyDeleteExpiredAccounts = async () => {
  const [result] = await pool.execute(
    `DELETE FROM users
        WHERE is_account_deleted = 1
        AND account_deleted_at IS NOT NULL
        AND account_deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
  );

  return result.affectedRows;
};

export const createAccountDeletionFeedback = async ({
  userId,
  reason,
  otherReason,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO account_deletion_feedback
        (
            user_id,
            reason,
            other_reason
        )
        VALUES (?, ?, ?)`,
    [userId, reason, reason === "OTHER" ? otherReason : null],
  );

  return result.insertId;
};

export const updateUserEmailIfEmpty = async (userId, email) => {
  if (!email) return;

  await pool.execute(
    `UPDATE users
     SET email = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND (email IS NULL OR email = '')`,
    [email, userId],
  );
};
