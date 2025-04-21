import cron from "node-cron";
import {
    syncDataToMeilisearch,
    updateRatingsInMeilisearch,
} from "../services/sync.js";

export const setupCronJobs = () => {
    // Update ratings every 15 minutes
    cron.schedule("*/15 * * * *", () => {
        updateRatingsInMeilisearch().catch((err) => {
            console.error("Cron job for updating ratings failed:", err);
        });
    });

    // Full sync every hour
    cron.schedule("0 * * * *", () => {
        syncDataToMeilisearch().catch((err) => {
            console.error("Cron job for full sync failed:", err);
        });
    });

    console.info("Cron jobs scheduled");
};
