
import pool from "../configs/database/db.js";

const CAMPAIGN_TIMEZONE = "Asia/Kolkata";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const saveCampaign = async (adId, userId, data) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ads] = await connection.execute(
      `
        SELECT id, business_id, campaign_id
        FROM ads
        WHERE id = ?
          AND user_id = ?
          AND status = 'draft'
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (ads.length === 0) {
      throw createError(
        "Draft ad not found or you do not own this ad.",
        404,
      );
    }

    const ad = ads[0];
    let campaignId = ad.campaign_id;

    const startDate = data.start_date
      ? `${data.start_date} 00:00:00`
      : null;

    const endDate = data.end_date
      ? `${data.end_date} 00:00:00`
      : null;

    const timezone = data.timezone || CAMPAIGN_TIMEZONE;

    if (campaignId) {
      const [campaigns] = await connection.execute(
        `
          SELECT id
          FROM ad_campaigns
          WHERE id = ?
            AND user_id = ?
            AND status = 'draft'
          LIMIT 1
          FOR UPDATE
        `,
        [campaignId, userId],
      );

      if (campaigns.length === 0) {
        throw createError("Draft campaign not found.", 404);
      }

      await connection.execute(
        `
          UPDATE ad_campaigns
          SET
            business_id = ?,
            budget_type = 'daily',
            total_budget = ?,
            daily_budget = ?,
            duration_type = ?,
            duration_days = ?,
            start_date = ?,
            end_date = ?,
            timezone = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND user_id = ?
            AND status = 'draft'
        `,
        [
          ad.business_id,
          data.total_budget,
          data.daily_budget,
          data.duration_type,
          data.duration_days,
          startDate,
          endDate,
          timezone,
          campaignId,
          userId,
        ],
      );
    } else {
      const [result] = await connection.execute(
        `
          INSERT INTO ad_campaigns (
            user_id,
            business_id,
            budget_type,
            total_budget,
            daily_budget,
            duration_type,
            duration_days,
            start_date,
            end_date,
            timezone,
            status
          )
          VALUES (
            ?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, 'draft'
          )
        `,
        [
          userId,
          ad.business_id,
          data.total_budget,
          data.daily_budget,
          data.duration_type,
          data.duration_days,
          startDate,
          endDate,
          timezone,
        ],
      );

      campaignId = result.insertId;

      await connection.execute(
        `
          UPDATE ads
          SET
            campaign_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND user_id = ?
            AND status = 'draft'
        `,
        [campaignId, adId, userId],
      );
    }

    const [rows] = await connection.execute(
      `
        SELECT
          id,
          user_id,
          business_id,
          budget_type,
          total_budget,
          daily_budget,
          duration_type,
          duration_days,
          start_date,
          end_date,
          timezone,
          status,
          created_at,
          updated_at
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `,
      [campaignId, userId],
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

const getDraftCampaignForPublish = async (adId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id AS ad_id,
        a.campaign_id,
        a.status AS ad_status,
        c.id AS id,
        c.user_id,
        c.business_id,
        c.duration_type,
        c.duration_days,
        DATE_FORMAT(c.start_date, '%Y-%m-%d') AS selected_start_date,
        DATE_FORMAT(c.end_date, '%Y-%m-%d') AS selected_end_date,
        c.timezone,
        c.status AS campaign_status
      FROM ads a
      INNER JOIN ad_campaigns c
        ON c.id = a.campaign_id
      WHERE a.id = ?
        AND a.user_id = ?
        AND a.status = 'draft'
        AND c.user_id = ?
        AND c.status = 'draft'
      LIMIT 1
    `,
    [adId, userId, userId],
  );

  if (rows.length === 0) {
    throw createError("Draft campaign not found.", 404);
  }

  return rows[0];
};

const publishCampaign = async (
  adId,
  userId,
  { startDateTime, endDateTime, campaignStatus },
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ads] = await connection.execute(
      `
        SELECT id, campaign_id, status
        FROM ads
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [adId, userId],
    );

    if (ads.length === 0 || ads[0].status !== "draft") {
      throw createError("Draft ad not found or already published.", 404);
    }

    const campaignId = ads[0].campaign_id;

    if (!campaignId) {
      throw createError("Campaign details have not been saved.", 400);
    }

    const [campaigns] = await connection.execute(
      `
        SELECT id, status
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [campaignId, userId],
    );

    if (
      campaigns.length === 0 ||
      campaigns[0].status !== "draft"
    ) {
      throw createError(
        "Draft campaign not found or already published.",
        400,
      );
    }

    await connection.execute(
      `
        UPDATE ad_campaigns
        SET
          start_date = ?,
          end_date = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'draft'
      `,
      [
        startDateTime,
        endDateTime,
        campaignStatus,
        campaignId,
        userId,
      ],
    );

    if (campaignStatus === "active") {
      await connection.execute(
        `
          UPDATE ads
          SET
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND user_id = ?
            AND status = 'draft'
        `,
        [adId, userId],
      );
    }

    const [rows] = await connection.execute(
      `
        SELECT
          id,
          user_id,
          business_id,
          budget_type,
          total_budget,
          daily_budget,
          duration_type,
          duration_days,
          start_date,
          end_date,
          timezone,
          status,
          created_at,
          updated_at
        FROM ad_campaigns
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `,
      [campaignId, userId],
    );

    await connection.commit();

    return {
      campaign: rows[0] || null,
      ad_status: campaignStatus === "active" ? "active" : "draft",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  saveCampaign,
  getDraftCampaignForPublish,
  publishCampaign,
};
