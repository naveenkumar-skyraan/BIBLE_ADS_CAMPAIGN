import db from "../configs/database/db.js";

export const updateAdModeration = async ({
  adId,
  adminId,
  action,
  reason,
}) => {
  const connection = await db.getConnection();

  const actions = {
    block: {
      currentModerationStatus: "none",
      nextModerationStatus: "blocked",
      eventType: "blocked",
    },
    approve: {
      currentModerationStatus: "under_review",
      nextModerationStatus: "none",
      eventType: "approved",
    },
    reject: {
      currentModerationStatus: "under_review",
      nextModerationStatus: "blocked",
      eventType: "rejected",
    },
  };

  const config = actions[action];

  if (!config) {
    connection.release();
    throw new Error("Invalid moderation action.");
  }

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          a.id,
          a.user_id,
          a.campaign_id,
          a.status,
          a.moderation_status,
          a.is_deleted AS ad_is_deleted,
          c.is_deleted AS campaign_is_deleted
        FROM ads a
        INNER JOIN ad_campaigns c
          ON c.id = a.campaign_id
          AND c.user_id = a.user_id
        WHERE a.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [adId],
    );

    if (!rows.length) {
      await connection.rollback();
      return { notFound: true };
    }

    const ad = rows[0];

    if (
      Number(ad.ad_is_deleted) === 1 ||
      Number(ad.campaign_is_deleted) === 1
    ) {
      await connection.rollback();
      return { notFound: true };
    }

    if (
      ad.status !== "active" ||
      ad.moderation_status !== config.currentModerationStatus
    ) {
      await connection.rollback();
      return { invalidState: true };
    }

    const [updateResult] = await connection.execute(
      `
        UPDATE ads
        SET
          moderation_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'active'
          AND moderation_status = ?
          AND is_deleted = 0
      `,
      [config.nextModerationStatus, adId, config.currentModerationStatus],
    );

    if (updateResult.affectedRows !== 1) {
      await connection.rollback();
      return { invalidState: true };
    }

    const [historyResult] = await connection.execute(
      `
        INSERT INTO ad_moderation_history (
          ad_id,
          user_id,
          admin_id,
          event_type,
          reason
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        adId,
        ad.user_id,
        adminId,
        config.eventType,
        reason || null,
      ],
    );

    await connection.commit();

    return {
      success: true,
      historyId: historyResult.insertId,
      moderationStatus: config.nextModerationStatus,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};