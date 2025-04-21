import { MeiliSearch } from "meilisearch";
import config from "../config/index.js";
import * as meiliConfig from "../config/meilisearch.js";

const client = new MeiliSearch({
    host: config.meilisearch.host,
    apiKey: config.meilisearch.apiKey,
});

const indexName = config.meilisearch.indexName;

export const getIndex = () => client.index(indexName);

export const initializeIndex = async () => {
    try {
        const index = getIndex();

        // Configure searchable attributes
        await index.updateSearchableAttributes(
            meiliConfig.searchableAttributes
        );

        // Configure filterable attributes
        await index.updateFilterableAttributes(
            meiliConfig.filterableAttributes
        );

        // Configure sortable attributes
        await index.updateSortableAttributes(meiliConfig.sortableAttributes);

        // Configure typo tolerance settings
        await index.updateTypoTolerance(meiliConfig.typoTolerance);

        // Configure synonyms for better fuzzy matching
        await index.updateSynonyms(meiliConfig.synonyms);

        console.info("Meilisearch index configured successfully");
        return true;
    } catch (error) {
        console.error("Error configuring Meilisearch index:", error);
        throw error;
    }
};

export const resetIndex = async () => {
    try {
        console.info("Resetting Meilisearch index");

        // Delete the index if it exists
        try {
            await client.deleteIndex(indexName);
            console.info("Deleted existing index");
        } catch (error) {
            console.info(
                "Index didn't exist or couldn't be deleted:",
                error.message
            );
        }

        // Create a fresh index
        await client.createIndex(indexName, { primaryKey: "id" });
        console.info("Created new index with primaryKey 'id'");

        // Configure the index
        await initializeIndex();

        return true;
    } catch (error) {
        console.error("Error resetting Meilisearch index:", error);
        throw error;
    }
};

export default client;
