import cron from "node-cron";
import {
  permanentlyDeleteExpiredAccounts,
} from "../models/userModel.js";

export const startAccountDeletionJob = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      const affectedCount =
        await permanentlyDeleteExpiredAccounts();

      console.log(
        `Marked ${affectedCount} inactive users as permanently deleted.`
      );
    } catch (error) {
      console.error(
        "Inactive user cleanup job failed:",
        error
      );
    }
  });
};