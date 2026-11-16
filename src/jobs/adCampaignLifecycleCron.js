
import cron from "node-cron";
import db from "../configs/database/db.js";

let lifecycleJob = null;
let isRunning = false;

export const startAdCampaignLifecycleJob = () => {
  // Prevent accidental duplicate cron registration.
  if (lifecycleJob) {
    console.log("Ad campaign lifecycle scheduler is already registered.");
    return;
  }

  lifecycleJob = cron.schedule("* * * * *", async () => {
    // Prevent overlapping executions in this server process.
    if (isRunning) {
      return;
    }

    isRunning = true;

    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const nowTimestamp = Math.floor(Date.now() / 1000);

      // 1. Activate scheduled campaigns when their start time arrives.
      // Paused and soft-deleted campaigns are deliberately excluded.
      const [activatedCampaigns] = await connection.execute(
        `
          UPDATE ad_campaigns
          SET
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE status = 'draft'
            AND is_deleted = 0
            AND start_timestamp IS NOT NULL
            AND end_timestamp IS NOT NULL
            AND start_timestamp <= ?
            AND end_timestamp >= ?
        `,
        [nowTimestamp, nowTimestamp],
      );

      // 2. Activate the corresponding draft ad only when moderation
      // permits delivery. The campaign and ad form a one-to-one pair.
      // Soft-deleted campaigns and ads are excluded.
      const [activatedAds] = await connection.execute(
        `
          UPDATE ads a
          INNER JOIN ad_campaigns c
            ON c.id = a.campaign_id
            AND c.user_id = a.user_id
          SET
            a.status = 'active',
            a.updated_at = CURRENT_TIMESTAMP
          WHERE c.status = 'active'
            AND c.is_deleted = 0
            AND c.start_timestamp <= ?
            AND c.end_timestamp >= ?
            AND a.status = 'draft'
            AND a.moderation_status = 'none'
            AND a.is_deleted = 0
        `,
        [nowTimestamp, nowTimestamp],
      );

      // 3. Resume campaigns paused by the daily budget at the next
      // campaign-local day. Manual and wallet-insufficient pauses are not
      // resumed by this job.
      const [resumableCampaigns] = await connection.execute(
        `
          SELECT
            c.id AS campaign_id,
            a.id AS ad_id
          FROM ad_campaigns c
          INNER JOIN ads a
            ON a.campaign_id = c.id
            AND a.user_id = c.user_id
          WHERE c.status = 'paused'
            AND c.pause_reason = 'daily_budget'
            AND c.resume_at IS NOT NULL
            AND c.resume_at <= ?
            AND c.start_timestamp IS NOT NULL
            AND c.start_timestamp <= ?
            AND c.end_timestamp IS NOT NULL
            AND c.end_timestamp >= ?
            AND c.is_deleted = 0
            AND a.status = 'paused'
            AND a.moderation_status = 'none'
            AND a.is_deleted = 0
          ORDER BY c.id
          FOR UPDATE
        `,
        [nowTimestamp, nowTimestamp, nowTimestamp],
      );

      let resumedCampaignCount = 0;
      let resumedAdCount = 0;

      for (const campaign of resumableCampaigns) {
        const [campaignUpdate] = await connection.execute(
          `
            UPDATE ad_campaigns
            SET
              status = 'active',
              pause_reason = NULL,
              resume_at = NULL,
              paused_at = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'paused'
              AND pause_reason = 'daily_budget'
              AND resume_at <= ?
              AND is_deleted = 0
          `,
          [campaign.campaign_id, nowTimestamp],
        );

        if (campaignUpdate.affectedRows !== 1) {
          continue;
        }

        const [adUpdate] = await connection.execute(
          `
            UPDATE ads
            SET status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND campaign_id = ?
              AND status = 'paused'
              AND moderation_status = 'none'
              AND is_deleted = 0
          `,
          [campaign.ad_id, campaign.campaign_id],
        );

        if (adUpdate.affectedRows !== 1) {
          throw new Error(
            `Ad ${campaign.ad_id} could not be resumed with campaign ${campaign.campaign_id}.`,
          );
        }

        await connection.execute(
          `
            UPDATE ad_campaign_pause_history
            SET resumed_at = ?
            WHERE campaign_id = ?
              AND ad_id = ?
              AND resumed_at IS NULL
          `,
          [nowTimestamp, campaign.campaign_id, campaign.ad_id],
        );

        resumedCampaignCount += 1;
        resumedAdCount += 1;
      }

      // 4. Complete campaigns after their end time.
      // Draft campaigns that have already passed their entire schedule
      // are also completed. Manually paused campaigns expire normally.
      // Soft-deleted campaigns are excluded.
      const [completedCampaigns] = await connection.execute(
        `
          UPDATE ad_campaigns
          SET
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP
          WHERE status IN ('active', 'paused', 'draft')
            AND is_deleted = 0
            AND end_timestamp IS NOT NULL
            AND end_timestamp < ?
        `,
        [nowTimestamp],
      );

      // 5. Complete the corresponding ad when its campaign completes.
      // Soft-deleted campaigns and ads are excluded.
      const [completedAds] = await connection.execute(
        `
          UPDATE ads a
          INNER JOIN ad_campaigns c
            ON c.id = a.campaign_id
            AND c.user_id = a.user_id
          SET
            a.status = 'completed',
            a.updated_at = CURRENT_TIMESTAMP
          WHERE c.status = 'completed'
            AND c.is_deleted = 0
            AND a.status IN ('active', 'paused', 'draft')
            AND a.is_deleted = 0
        `,
      );

      await connection.commit();

      const activatedCount = activatedCampaigns.affectedRows;
      const completedCount = completedCampaigns.affectedRows;

      if (
        activatedCount > 0 ||
        resumedCampaignCount > 0 ||
        completedCount > 0
      ) {
        console.log(
          [
            "Ad campaign lifecycle:",
            `${activatedCount} campaigns activated`,
            `${activatedAds.affectedRows} ads activated`,
            `${resumedCampaignCount} campaigns resumed`,
            `${resumedAdCount} ads resumed`,
            `${completedCount} campaigns completed`,
            `${completedAds.affectedRows} ads completed`,
          ].join(" | "),
        );
      }
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Ad lifecycle transaction rollback failed:",
            rollbackError,
          );
        }
      }

      console.error("Ad campaign lifecycle job failed:", error);
    } finally {
      connection?.release();
      isRunning = false;
    }
  });

  console.log("Ad campaign lifecycle scheduler started.");
};
