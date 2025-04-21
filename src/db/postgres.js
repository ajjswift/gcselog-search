import pg from "pg";
import config from "../config/index.js";

const pgPool = new pg.Pool({
    connectionString: config.database.url,
});

export const connect = async () => {
    try {
        await pgPool.connect();
        console.log("Connected to PostgreSQL database");
        return true;
    } catch (error) {
        console.error("Failed to connect to PostgreSQL:", error);
        throw error;
    }
};

export const initializeDatabase = async () => {
    try {
        // Check if the table exists
        const tableCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Resource'
      );
    `);

        const tableExists = tableCheck.rows[0].exists;

        if (!tableExists) {
            console.info("Creating Resource table in PostgreSQL");

            // Create the table
            await pgPool.query(`
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

            console.info("Resource table created successfully");
        }
        return true;
    } catch (error) {
        console.error("Error initializing database:", error);
        throw error;
    }
};

export const query = (text, params) => pgPool.query(text, params);

export default pgPool;
