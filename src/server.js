import Fastify from "fastify";
import config from "./config/index.js";
import { connect } from "./db/postgres.js";
import { syncDataToMeilisearch } from "./services/sync.js";
import registerRoutes from "./routes/index.js";
import { setupCronJobs } from "./cron/index.js";

// Initialize Fastify
const fastify = Fastify({
    logger: process.env.NODE_ENV !== "production",
});

// Register routes
registerRoutes(fastify);

// Run initial setup when server starts
fastify.addHook("onReady", async () => {
    try {
        // Connect to PostgreSQL
        await connect();

        // Initial sync of data
        await syncDataToMeilisearch();

        // Setup cron jobs
        setupCronJobs();
    } catch (error) {
        fastify.log.error("Error during server initialization:", error);
    }
});

// Start the server
const start = async () => {
    try {
        await fastify.listen({ port: config.port, host: "0.0.0.0" });
        console.log(`Server is running on port ${config.port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
