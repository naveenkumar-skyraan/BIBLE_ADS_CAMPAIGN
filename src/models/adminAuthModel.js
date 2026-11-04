import pool from "../configs/database/db.js";

export const getAdminByEmail = async (email) => {
  const [rows] = await pool.execute(
    `
        SELECT
            id,
            name,
            email,
            password_hash,
            profile_image,
            is_active,
            created_at,
            updated_at
        FROM admins
        WHERE email = ?
        LIMIT 1
        `,
    [email],
  );

  return rows[0] || null;
};

export const getAdminProfileById = async (id) => {
  const [rows] = await pool.execute(
    `
        SELECT
            id,
            name,
            email,
            profile_image,
            is_active,
            created_at,
            updated_at
        FROM admins
        WHERE id = ?
        LIMIT 1
        `,
    [id],
  );

  return rows[0] || null;
};

export const getAdminPasswordById = async (id) => {
  const [rows] = await pool.execute(
    `
        SELECT password_hash
        FROM admins
        WHERE id = ?
        LIMIT 1
        `,
    [id],
  );

  return rows[0] || null;
};

export const getAdminByEmailExceptId = async (email, id) => {
  const [rows] = await pool.execute(
    `
        SELECT id
        FROM admins
        WHERE email = ?
          AND id != ?
        LIMIT 1
        `,
    [email, id],
  );

  return rows[0] || null;
};

export const updateAdminProfile = async (id, { name, email, profileImage }) => {
  await pool.execute(
    `
        UPDATE admins
        SET
            name = ?,
            email = ?,
            profile_image = COALESCE(?, profile_image),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
    [name, email, profileImage ?? null, id],
  );

  return await getAdminProfileById(id);
};

export const updateAdminPassword = async (id, passwordHash) => {
  const [result] = await pool.execute(
    `
        UPDATE admins
        SET
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
    [passwordHash, id],
  );

  return result.affectedRows > 0;
};

export const updateAdminProfileAndPassword = async (
  id,
  { name, email, profileImage, passwordHash },
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
            UPDATE admins
            SET
                name = ?,
                email = ?,
                profile_image = COALESCE(?, profile_image),
                password_hash = COALESCE(?, password_hash),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
      [name, email, profileImage ?? null, passwordHash ?? null, id],
    );

    const [rows] = await connection.execute(
      `
            SELECT
                id,
                name,
                email,
                profile_image,
                is_active,
                created_at,
                updated_at
            FROM admins
            WHERE id = ?
            LIMIT 1
            `,
      [id],
    );

    await connection.commit();

    return rows[0] || null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
