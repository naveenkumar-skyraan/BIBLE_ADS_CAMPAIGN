import pool from "../configs/database/db.js";

export const findUserByPhone = async (phone) => {
  const [rows] = await pool.execute(
    `SELECT
        id,
        name,
        phone,
        email,
        is_email_verified,
        email_otp,
        email_otp_expires_at,
        email_otp_purpose,
        password_hash,
        is_phone_verified,
        is_oauth_login,
        oauth_provider_id,
        oauth_provider,
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

export const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT
        id,
        name,
        phone,
        email,
        is_email_verified,
        email_otp,
        email_otp_expires_at,
        email_otp_purpose,
        password_hash,
        is_phone_verified,
        is_oauth_login,
        oauth_provider_id,
        oauth_provider,
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
     WHERE email = ?
     LIMIT 1`,
    [email.trim().toLowerCase()],
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
            is_oauth_login,
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
  phone = null,
  email = "",
  passwordHash = "",
  otp = "",
  otpExpiresAt = null,
  otpPurpose = "",
  isOauthLogin = 0,
  oauthProviderId = "",
  oauthProvider = 0,
  isPhoneVerified = 0,
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
      phone ?? null,
      email?.trim().toLowerCase() || null,
      passwordHash || "",
      isPhoneVerified,
      otp ?? null,
      otpExpiresAt ?? null,
      otpPurpose ?? null,
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

export const setProfilePhoneForOtp = async (userId, phone) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
       phone = ?,
       is_phone_verified = 0,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND is_account_deleted = 0`,
    [phone, userId],
  );

  return result.affectedRows;
};

export const verifyProfilePhone = async (userId, phone) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
       is_phone_verified = 1,
       otp = NULL,
       otp_expires_at = NULL,
       otp_purpose = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND phone = ?
       AND otp_purpose = 'profile'`,
    [userId, phone],
  );

  return result.affectedRows;
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

export const completePendingSignup = async ({
  userId,
  name,
  email,
  phone,
  passwordHash,
}) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
       name = CASE
         WHEN name IS NULL OR name = '' THEN ?
         ELSE name
       END,
       password_hash = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND email = ?
       AND phone = ?
       AND is_email_verified = 1
       AND is_phone_verified = 1
       AND is_account_deleted = 0
       AND (password_hash IS NULL OR password_hash = '')`,
    [name, passwordHash, userId, email.trim().toLowerCase(), phone],
  );

  return result.affectedRows;
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

export const createPendingEmailVerification = async ({
  email,
  emailOtp,
  emailOtpExpiresAt,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO users (
       name,
       email,
       is_email_verified,
       email_otp,
       email_otp_expires_at,
       email_otp_purpose,
       is_phone_verified,
       is_oauth_login,
       oauth_provider,
       is_account_deleted
     )
     VALUES ('', ?, 0, ?, ?, 'signup', 0, 0, 0, 0)`,
    [email.trim().toLowerCase(), emailOtp, emailOtpExpiresAt],
  );

  return result.insertId;
};

export const updateSignupPhoneForOtp = async ({
  userId,
  phone,
  otp,
  otpExpiresAt,
}) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
       phone = ?,
       is_phone_verified = 0,
       otp = ?,
       otp_expires_at = ?,
       otp_purpose = 'signup',
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND is_email_verified = 1
       AND is_account_deleted = 0
       AND (password_hash IS NULL OR password_hash = '')`,
    [phone, otp, otpExpiresAt, userId],
  );

  return result.affectedRows;
};

export const updatePassword = async (
  userId,
  passwordHash,
  switchToNormalLogin = false,
) => {
  await pool.execute(
    `UPDATE users
     SET
       password_hash = ?,
       is_oauth_login = CASE WHEN ? = 1 THEN 0 ELSE is_oauth_login END,
       oauth_provider_id = CASE WHEN ? = 1 THEN NULL ELSE oauth_provider_id END,
       oauth_provider = CASE WHEN ? = 1 THEN 0 ELSE oauth_provider END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      passwordHash,
      switchToNormalLogin ? 1 : 0,
      switchToNormalLogin ? 1 : 0,
      switchToNormalLogin ? 1 : 0,
      userId,
    ],
  );
};

export const updateUserSocialLogin = async ({
  userId,
  provider,
  providerUserId,
}) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
       is_oauth_login = CASE
         WHEN password_hash IS NULL OR password_hash = '' THEN 1
         ELSE is_oauth_login
       END,
       oauth_provider_id = CASE
         WHEN oauth_provider_id IS NULL OR oauth_provider_id = ''
           THEN ?
         ELSE oauth_provider_id
       END,
       oauth_provider = CASE
         WHEN oauth_provider IS NULL OR oauth_provider = 0
           THEN ?
         ELSE oauth_provider
       END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND is_account_deleted = 0`,
    [providerUserId, provider, userId],
  );

  return result.affectedRows;
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

export const createPendingEmailUser = async ({
  name,
  email,
  phone,
  passwordHash,
  emailOtp,
  emailOtpExpiresAt,
  phoneOtp,
  phoneOtpExpiresAt,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO users (
        name,
        email,
        phone,
        is_email_verified,
        email_otp,
        email_otp_expires_at,
        email_otp_purpose,
        password_hash,
        is_phone_verified,
        otp,
        otp_expires_at,
        otp_purpose,
        is_oauth_login,
        oauth_provider,
        is_account_deleted
     )
     VALUES (?, ?, ?, 0, ?, ?, 'signup', ?, 0, ?, ?, 'signup', 0, 0, 0)`,
    [
      name,
      email.trim().toLowerCase(),
      phone,
      emailOtp,
      emailOtpExpiresAt,
      passwordHash,
      phoneOtp,
      phoneOtpExpiresAt,
    ],
  );

  return result.insertId;
};

export const updatePendingEmailSignup = async ({
  userId,
  name,
  phone,
  passwordHash,
  emailOtp,
  emailOtpExpiresAt,
  phoneOtp,
  phoneOtpExpiresAt,
}) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
        name = ?,
        phone = ?,
        password_hash = ?,
        email_otp = ?,
        email_otp_expires_at = ?,
        email_otp_purpose = 'signup',
        otp = ?,
        otp_expires_at = ?,
        otp_purpose = 'signup',
        is_phone_verified = 0,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND is_email_verified = 0
       AND is_account_deleted = 0`,
    [
      name,
      phone,
      passwordHash,
      emailOtp,
      emailOtpExpiresAt,
      phoneOtp,
      phoneOtpExpiresAt,
      userId,
    ],
  );

  return result.affectedRows;
};

export const updateEmailOtp = async ({
  userId,
  emailOtp,
  emailOtpExpiresAt,
  emailOtpPurpose,
}) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
        email_otp = ?,
        email_otp_expires_at = ?,
        email_otp_purpose = ?,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND is_account_deleted = 0`,
    [emailOtp, emailOtpExpiresAt, emailOtpPurpose, userId],
  );

  return result.affectedRows;
};

export const verifyEmailAddress = async (userId) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET
        is_email_verified = 1,
        email_otp = NULL,
        email_otp_expires_at = NULL,
        email_otp_purpose = NULL,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND email_otp_purpose = 'signup'
       AND is_account_deleted = 0`,
    [userId],
  );

  return result.affectedRows;
};

export const clearEmailOtp = async (userId) => {
  await pool.execute(
    `UPDATE users
     SET
        email_otp = NULL,
        email_otp_expires_at = NULL,
        email_otp_purpose = NULL,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [userId],
  );
};
