import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export default {
    port: process.env.PORT || 4003,
    database: {
        url:
            process.env.DATABASE_URL ||
            "postgresql://postgres:postgres@localhost:5432/postgres",
    },
    meilisearch: {
        host: process.env.MEILI_HOST || "http://localhost:7700",
        apiKey: process.env.MEILI_API_KEY || "",
        indexName: "resources",
    },
};
