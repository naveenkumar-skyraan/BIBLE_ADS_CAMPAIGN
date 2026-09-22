
import cron from "node-cron";
import {permanentlyDeleteExpiredAccounts} from "../models/userModel.js";

export const startAccountDeletionJob = () => {
    cron.schedule("0 0 * * *", async () => {
        try {
            const deletedCount =
                await permanentlyDeleteExpiredAccounts();

            console.log(
                `Permanently deleted ${deletedCount} expired accounts.`
            );
        } catch (error) {
            console.error(
                "Account deletion job failed:",
                error
            );
        }
    });
};