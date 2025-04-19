import Fastify from "fastify";
import { MeiliSearch } from "meilisearch";
import pg from "pg";
import cron from "node-cron";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Fastify
const fastify = Fastify({
    logger: true,
});

// Initialize MeiliSearch client
const meiliClient = new MeiliSearch({
    host: process.env.MEILI_HOST || "http://localhost:7700",
    apiKey: process.env.MEILI_API_KEY || "",
});

const indexName = "resources";

// Initialize PostgreSQL client
const pgClient = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/postgres",
});

// Function to initialize the database
async function initializeDatabase() {
    try {
        // Check if the table exists
        const tableCheck = await pgClient.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'Resource'
            );
        `);

        const tableExists = tableCheck.rows[0].exists;

        if (!tableExists) {
            fastify.log.info("Creating Resource table in PostgreSQL");

            // Create the table
            await pgClient.query(`
                CREATE TABLE "Resource" (
                    id SERIAL PRIMARY KEY,
                    resourceId TEXT NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    level TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    examBoard TEXT NOT NULL,
                    link TEXT NOT NULL,
                    author TEXT NOT NULL,
                    averageRating FLOAT8 DEFAULT 0,
                    description TEXT
                );
                
                CREATE INDEX resource_resourceId_key ON "Resource"(resourceId);
            `);

            fastify.log.info("Resource table created successfully");
        }
    } catch (error) {
        fastify.log.error("Error initializing database:", error);
        throw error;
    }
}

// Function to import sample data
async function importSampleData(data) {
    try {
        // Check if data already exists
        const countResult = await pgClient.query(
            'SELECT COUNT(*) FROM "Resource"'
        );
        const count = parseInt(countResult.rows[0].count);

        if (count > 0) {
            fastify.log.info(
                `Database already contains ${count} resources, skipping import`
            );
            return;
        }

        fastify.log.info(`Importing ${data.length} resources to PostgreSQL`);

        // Begin transaction
        await pgClient.query("BEGIN");

        // Prepare the insert query
        const insertQuery = `
            INSERT INTO "Resource" (
                resourceId, type, title, level, subject, examBoard, 
                link, author, averageRating, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        // Insert each resource
        for (const resource of data) {
            await pgClient.query(insertQuery, [
                resource["Resource ID"].toString(),
                resource["Resource Type"],
                resource["Resource Title"],
                resource["Study Level"],
                resource["Subject"],
                resource["Exam Board"],
                resource["Link"],
                resource["Resource Author"],
                resource["Average Rating"],
                resource["Resource Description"],
            ]);
        }

        // Commit transaction
        await pgClient.query("COMMIT");

        fastify.log.info("Sample data imported successfully");
    } catch (error) {
        // Rollback transaction on error
        await pgClient.query("ROLLBACK");
        fastify.log.error("Error importing sample data:", error);
        throw error;
    }
}

// Function to sync data from PostgreSQL to Meilisearch
// Function to sync data from PostgreSQL to Meilisearch
async function syncDataToMeilisearch() {
    const index = meiliClient.index(indexName);

    try {
        fastify.log.info("Starting sync from PostgreSQL to Meilisearch");

        // Get all resources from PostgreSQL
        const { rows: resources } = await pgClient.query(
            'SELECT * FROM "Resource"'
        );
        // Get all document IDs currently in Meilisearch
        const { results: meiliDocs } = await index.getDocuments({
            limit: 10000,
        });
        const meiliIds = new Set(meiliDocs.map((doc) => doc.id.toString()));

        // Prepare documents to add/update
        const docsToUpsert = resources.map((resource) => ({
            id: resource.id.toString(),
            resourceId: resource["resourceid"]
                ? resource["resourceid"].toString()
                : "",
            type: resource.type,
            title: resource.title,
            level: resource.level,
            subject: resource.subject,
            examBoard: resource["examBoard"],
            link: resource.link,
            author: resource.author,
            averageRating: resource["averagerating"] || 0,
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
            fastify.log.info(
                `Upserting ${docsToUpsert.length} documents to Meilisearch`
            );
            await index.addDocuments(docsToUpsert);
        }

        if (idsToDelete.length > 0) {
            fastify.log.info(
                `Deleting ${idsToDelete.length} documents from Meilisearch`
            );
            await index.deleteDocuments(idsToDelete);
        }

        fastify.log.info("Sync completed successfully");
    } catch (error) {
        console.error(error);
        fastify.log.error("Error syncing data to Meilisearch:", error);
    }
}

// Function to initialize Meilisearch index settings
async function initializeMeilisearchIndex() {
    try {
        const index = meiliClient.index(indexName);

        // Configure searchable attributes
        await index.updateSearchableAttributes([
            "title",
            "description",
            "subject",
            "examBoard",
            "level",
            "type",
            "author",
            "tags",
        ]);

        // Configure filterable attributes
        await index.updateFilterableAttributes([
            "subject",
            "examBoard",
            "level",
            "type",
            "author",
            "tags",
            "averageRating",
        ]);

        // Configure sortable attributes
        await index.updateSortableAttributes(["averageRating", "title"]);

        fastify.log.info("Meilisearch index configured successfully");
    } catch (error) {
        fastify.log.error("Error configuring Meilisearch index:", error);
    }
}

// Schedule cron job to run every hour
cron.schedule("0 * * * *", () => {
    syncDataToMeilisearch();
});

// Run initial setup when server starts
fastify.addHook("onReady", async () => {
    try {
        await pgClient.connect();
        fastify.log.info("Connected to PostgreSQL database");

        //await initializeDatabase(); -- removed this as potentially destructive

        //await initializeMeilisearchIndex();
        await syncDataToMeilisearch();
    } catch (error) {
        fastify.log.error("Error during server initialization:", error);
    }
});

// Register a route to search Meilisearch
fastify.get("/search", async (request, reply) => {
    try {
        const {
            query = "",
            tags = "",
            subject = "",
            examBoard = "",
            level = "",
            type = "",
            limit = 20,
            offset = 0,
            sort = "",
        } = request.query;

        // Parse tags if provided
        const parsedTags = tags ? tags.toString().split(",") : [];

        // Build search parameters
        const searchParams = {
            limit: parseInt(limit.toString()),
            offset: parseInt(offset.toString()),
        };

        // Build filters array
        const filters = [];

        // Add filter for tags if provided
        if (parsedTags.length > 0) {
            filters.push(
                parsedTags.map((tag) => `tags = "${tag}"`).join(" AND ")
            );
        }

        // Add filter for subject if provided
        if (subject) {
            filters.push(`subject = "${subject}"`);
        }

        // Add filter for examBoard if provided
        if (examBoard) {
            filters.push(`examBoard = "${examBoard}"`);
        }

        // Add filter for level if provided
        if (level) {
            filters.push(`level = "${level}"`);
        }

        // Add filter for type if provided
        if (type) {
            filters.push(`type = "${type}"`);
        }

        // Combine all filters with AND
        if (filters.length > 0) {
            searchParams.filter = filters.join(" AND ");
        }

        // Add sorting if provided
        if (sort) {
            const [field, direction] = sort.toString().split(":");
            if (field && (direction === "asc" || direction === "desc")) {
                searchParams.sort = [`${field}:${direction}`];
            }
        }

        // Perform the search
        const index = meiliClient.index(indexName);
        const searchResults = await index.search(
            query.toString(),
            searchParams
        );

        return {
            hits: searchResults.hits,
            totalHits: searchResults.estimatedTotalHits,
            processingTimeMs: searchResults.processingTimeMs,
        };
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
            error: "An error occurred while searching",
            message: error.message,
        });
    }
});

// Add endpoint to manually trigger sync
fastify.post("/sync", async (request, reply) => {
    try {
        await syncDataToMeilisearch();
        return { status: "sync completed" };
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
            error: "An error occurred during manual sync",
            message: error.message,
        });
    }
});

// Add endpoint to get available filters
fastify.get("/filters", async (request, reply) => {
    try {
        const { rows: subjects } = await pgClient.query(
            'SELECT DISTINCT subject FROM "Resource" WHERE subject IS NOT NULL ORDER BY subject'
        );

        const { rows: examBoards } = await pgClient.query(
            'SELECT DISTINCT "examBoard" FROM "Resource" WHERE "examBoard" IS NOT NULL ORDER BY "examBoard"'
        );

        const { rows: levels } = await pgClient.query(
            'SELECT DISTINCT level FROM "Resource" WHERE level IS NOT NULL ORDER BY level'
        );

        const { rows: types } = await pgClient.query(
            'SELECT DISTINCT type FROM "Resource" WHERE type IS NOT NULL ORDER BY type'
        );

        return {
            subjects: subjects.map((row) => row.subject),
            examBoards: examBoards.map((row) => row.examBoard),
            levels: levels.map((row) => row.level),
            types: types.map((row) => row.type),
        };
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
            error: "An error occurred while fetching filters",
            message: error.message,
        });
    }
});

// Add endpoint to reset Meilisearch index
fastify.post("/reset-index", async (request, reply) => {
    try {
        fastify.log.info("Resetting Meilisearch index");

        // Delete the index if it exists
        try {
            await meiliClient.deleteIndex(indexName);
            fastify.log.info("Deleted existing index");
        } catch (error) {
            fastify.log.info(
                "Index didn't exist or couldn't be deleted:",
                error.message
            );
        }

        // Create a fresh index
        await meiliClient.createIndex(indexName, { primaryKey: "id" });
        fastify.log.info("Created new index with primaryKey 'id'");

        // Configure the index
        await initializeMeilisearchIndex();

        // Sync data
        await syncDataToMeilisearch();

        return { status: "index reset completed" };
    } catch (error) {
        fastify.log.error("Error resetting Meilisearch index:", error);
        return reply.code(500).send({
            error: "An error occurred while resetting the index",
            message: error.message,
        });
    }
});

// Health check endpoint
fastify.get("/health", async () => {
    return { status: "ok" };
});

// Start the server
const start = async () => {
    try {
        const port = process.env.PORT || 4003;
        await fastify.listen({ port, host: "0.0.0.0" });
        console.log(`Server is running on port ${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
