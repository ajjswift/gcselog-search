import * as db from "../db/postgres.js";
import { getIndex } from "./meilisearch.js";

export const updateRatingsInMeilisearch = async () => {
    try {
        console.info("Starting ratings update from PostgreSQL to Meilisearch");
        const index = getIndex();

        // Get all resources with their current ratings from PostgreSQL
        const { rows: resources } = await db.query(
            'SELECT id, "averageRating" FROM "Resource"'
        );

        // Prepare documents to update (only updating the rating field)
        const docsToUpdate = resources.map((resource) => ({
            id: resource.id.toString(),
            averageRating: resource.averageRating || 0,
        }));

        if (docsToUpdate.length > 0) {
            console.info(
                `Updating ratings for ${docsToUpdate.length} documents in Meilisearch`
            );
            // Use partial update to only update the rating field
            await index.updateDocuments(docsToUpdate);
            console.info("Ratings update completed successfully");
        } else {
            console.info("No ratings to update");
        }
        return true;
    } catch (error) {
        console.error("Error updating ratings in Meilisearch:", error);
        throw error;
    }
};

export const syncDataToMeilisearch = async () => {
    const index = getIndex();

    try {
        console.info("Starting sync from PostgreSQL to Meilisearch");

        // Get all resources from PostgreSQL
        const { rows: resources } = await db.query('SELECT * FROM "Resource"');

        // Get all document IDs currently in Meilisearch
        const { results: meiliDocs } = await index.getDocuments({
            limit: 10000,
        });
        const meiliIds = new Set(meiliDocs.map((doc) => doc.id.toString()));

        // Prepare documents to add/update
        const docsToUpsert = resources.map((resource) => ({
            id: resource.id.toString(),
            resourceId: resource["resourceId"],
            type: resource.type,
            title: resource.title,
            level: resource.level,
            subject: resource.subject,
            examBoard: resource["examBoard"],
            link: resource.link,
            author: resource.author,
            averageRating: resource["averageRating"] || 0,
            description: resource.description || "",
            // Create tags from subject, level, and examBoard for better filtering
            tags: [
                resource.subject,
                resource.level,
                resource["examboard"],
                resource.type,
            ].filter(Boolean), // Remove any null/undefined values
        }));

        // Find IDs to delete (documents in Meilisearch but not in PostgreSQL)
        const pgIds = new Set(resources.map((r) => r.id.toString()));
        const idsToDelete = [...meiliIds].filter((id) => !pgIds.has(id));

        // Perform batch operations
        if (docsToUpsert.length > 0) {
            console.info(
                `Upserting ${docsToUpsert.length} documents to Meilisearch`
            );
            await index.addDocuments(docsToUpsert);
        }

        if (idsToDelete.length > 0) {
            console.info(
                `Deleting ${idsToDelete.length} documents from Meilisearch`
            );
            await index.deleteDocuments(idsToDelete);
        }

        console.info("Sync completed successfully");
        return true;
    } catch (error) {
        console.error("Error syncing data to Meilisearch:", error);
        throw error;
    }
};
