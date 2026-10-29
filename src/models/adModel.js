import db from "../configs/database/db.js";

export const createAd = async (userId, data, fileData) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [adResult] = await connection.execute(
      `INSERT INTO ads (
                user_id,
                business_id,
                objective_id,
                ad_type_id,
                title,
                description,
                action_button_type_id,
                destination_link,
                platform,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        userId,
        data.business_id,
        data.objective_id,
        data.ad_type_id,
        data.title,
        data.description,
        data.action_button_type_id ?? null,
        data.destination_link || null,
        data.platform,
      ],
    );

    const adId = adResult.insertId;

    await connection.execute(
      `INSERT INTO ad_media (
                ad_id,
                media_type,
                file_url,
                file_name,
                mime_type,
                file_size,
                sort_order,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        adId,
        fileData.mediaType,
        fileData.fileUrl,
        fileData.fileName,
        fileData.mimeType,
        fileData.fileSize,
      ],
    );

    await connection.commit();

    return adId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getAdById = async (adId, userId) => {
  const [rows] = await db.execute(
    `SELECT
            a.id,
            a.campaign_id,
            a.user_id,
            a.business_id,
            a.objective_id,
            a.ad_type_id,
            a.title,
            a.description,
            a.action_button_type_id,
            a.destination_link,
            a.platform,
            a.status,
            a.created_at,
            a.updated_at,
            m.id AS media_id,
            m.media_type,
            m.file_url,
            m.file_name,
            m.mime_type,
            m.file_size
        FROM ads a
        LEFT JOIN ad_media m
            ON m.ad_id = a.id
            AND m.is_active = 1
        WHERE a.id = ?
            AND a.user_id = ?
        LIMIT 1`,
    [adId, userId],
  );

  return rows[0] ?? null;
};

export const updateAd = async (adId, userId, data, fileData = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      `SELECT id
             FROM ads
             WHERE id = ? AND user_id = ? AND status = 'draft'
             LIMIT 1
             FOR UPDATE`,
      [adId, userId],
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return { notFound: true };
    }

    const fields = [];
    const values = [];

    const editableFields = [
      "business_id",
      "objective_id",
      "title",
      "description",
      "ad_type_id",
      "action_button_type_id",
      "destination_link",
      "platform",
    ];

    for (const field of editableFields) {
      if (Object.hasOwn(data, field)) {
        fields.push(`${field} = ?`);
        values.push(data[field] === "" ? null : data[field]);
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = CURRENT_TIMESTAMP");

      await connection.execute(
        `UPDATE ads
                 SET ${fields.join(", ")}
                 WHERE id = ? AND user_id = ?`,
        [...values, adId, userId],
      );
    }

    if (fileData) {
      await connection.execute(
        `UPDATE ad_media
                 SET is_active = 0
                 WHERE ad_id = ? AND is_active = 1`,
        [adId],
      );

      await connection.execute(
        `INSERT INTO ad_media (
                    ad_id,
                    media_type,
                    file_url,
                    file_name,
                    mime_type,
                    file_size,
                    sort_order,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          adId,
          fileData.mediaType,
          fileData.fileUrl,
          fileData.fileName,
          fileData.mimeType,
          fileData.fileSize,
        ],
      );
    }

    await connection.commit();

    return { notFound: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
