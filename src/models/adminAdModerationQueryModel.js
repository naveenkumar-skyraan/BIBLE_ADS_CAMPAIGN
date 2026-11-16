import db from "../configs/database/db.js";

export const getModerationQueue = async ({ limit, offset, search }) => {
  const conditions = [
    "a.status = 'active'",
    "a.moderation_status = 'under_review'",
    "a.is_deleted = 0",
    "(a.campaign_id IS NULL OR c.is_deleted = 0)",
  ];

  const values = [];

  if (search) {
    conditions.push(`
      (
        a.title LIKE ?
        OR a.description LIKE ?
        OR b.business_name LIKE ?
        OR u.name LIKE ?
        OR u.email LIKE ?
        OR h.contact_email LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    values.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    );
  }

  const whereClause = conditions.join(" AND ");

  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM ads a
      LEFT JOIN business_details b
        ON b.id = a.business_id
      LEFT JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      LEFT JOIN users u
        ON u.id = a.user_id
      LEFT JOIN ad_moderation_history h
        ON h.id = (
          SELECT MAX(h2.id)
          FROM ad_moderation_history h2
          WHERE h2.ad_id = a.id
            AND h2.user_id = a.user_id
            AND h2.event_type = 'resubmitted'
        )
      WHERE ${whereClause}
    `,
    values,
  );

  const [rows] = await db.execute(
    `
      SELECT
        a.id AS ad_id,
        a.title,
        a.description,
        a.platform,
        a.status AS ad_status,
        a.moderation_status,
        a.created_at AS ad_created_at,

        u.id AS user_id,
        u.name AS advertiser_name,
        u.email AS advertiser_email,
        u.phone AS advertiser_phone,

        b.business_name,
        b.name AS business_contact_name,
        b.email AS business_email,

        c.id AS campaign_id,
        c.status AS campaign_status,
        c.budget_type,
        c.total_budget,
        c.daily_budget,
        c.start_date,
        c.end_date,
        c.timezone,

        m.id AS media_id,
        m.media_type,
        m.file_url,
        m.file_name,
        m.mime_type,
        m.file_size,

        h.id AS submission_history_id,
        h.update_reason,
        h.contact_email,
        h.document_name,
        h.document_mime_type,
        h.document_size,
        h.created_at AS submitted_at,
        (h.document_path IS NOT NULL) AS has_document

      FROM ads a

      LEFT JOIN users u
        ON u.id = a.user_id

      LEFT JOIN business_details b
        ON b.id = a.business_id

      LEFT JOIN ad_campaigns c
        ON c.id = a.campaign_id

      LEFT JOIN ad_media m
        ON m.ad_id = a.id
        AND m.is_active = 1

      LEFT JOIN ad_moderation_history h
        ON h.id = (
          SELECT MAX(h2.id)
          FROM ad_moderation_history h2
          WHERE h2.ad_id = a.id
            AND h2.user_id = a.user_id
            AND h2.event_type = 'resubmitted'
        )

      WHERE ${whereClause}

      ORDER BY h.created_at ASC, a.id ASC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset],
  );

  return {
    ads: rows,
    total: Number(countRows[0].total),
  };
};

export const getModerationDetails = async (adId) => {
  const [ads] = await db.execute(
    `
      SELECT
        a.id AS ad_id,
        a.campaign_id,
        a.user_id,
        a.business_id,
        a.title,
        a.description,
        a.destination_link,
        a.platform,
        a.status AS ad_status,
        a.moderation_status,
        a.created_at AS ad_created_at,

        u.name AS advertiser_name,
        u.email AS advertiser_email,
        u.phone AS advertiser_phone,

        b.name AS business_contact_name,
        b.business_name,
        b.email AS business_email,
        b.country_code,
        b.admin_area_1,
        b.admin_area_2,
        b.city,
        b.area,
        b.postal_code,

        c.status AS campaign_status,
        c.budget_type,
        c.total_budget,
        c.daily_budget,
        c.start_date,
        c.end_date,
        c.timezone,

        m.id AS media_id,
        m.media_type,
        m.file_url,
        m.file_name,
        m.mime_type,
        m.file_size

      FROM ads a

      LEFT JOIN users u
        ON u.id = a.user_id

      LEFT JOIN business_details b
        ON b.id = a.business_id

      LEFT JOIN ad_campaigns c
        ON c.id = a.campaign_id

      LEFT JOIN ad_media m
        ON m.ad_id = a.id
        AND m.is_active = 1

      WHERE a.id = ?
        AND a.status = 'active'
        AND a.moderation_status = 'under_review'
        AND a.is_deleted = 0
        AND (a.campaign_id IS NULL OR c.is_deleted = 0)

      LIMIT 1
    `,
    [adId],
  );

  if (!ads.length) {
    return null;
  }

  const [history] = await db.execute(
    `
      SELECT
        id,
        admin_id,
        event_type,
        reason,
        update_reason,
        contact_email,
        document_name,
        document_mime_type,
        document_size,
        (document_path IS NOT NULL) AS has_document,
        created_at
      FROM ad_moderation_history
      WHERE ad_id = ?
        AND user_id = ?
      ORDER BY id ASC
    `,
    [adId, ads[0].user_id],
  );

  return {
    ...ads[0],
    moderation_history: history,
  };
};

export const getModerationDocument = async (historyId) => {
  const [rows] = await db.execute(
    `
      SELECT
        h.id,
        h.ad_id,
        h.event_type,
        h.document_path,
        h.document_name,
        h.document_mime_type,
        h.document_size
      FROM ad_moderation_history h
      INNER JOIN ads a
        ON a.id = h.ad_id
        AND a.user_id = h.user_id
        AND a.is_deleted = 0
      LEFT JOIN ad_campaigns c
        ON c.id = a.campaign_id
        AND c.user_id = a.user_id
      WHERE h.id = ?
        AND h.event_type = 'resubmitted'
        AND h.document_path IS NOT NULL
        AND (a.campaign_id IS NULL OR c.is_deleted = 0)
      LIMIT 1
    `,
    [historyId],
  );

  return rows[0] ?? null;
};