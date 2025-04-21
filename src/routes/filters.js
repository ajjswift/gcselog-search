import * as db from "../db/postgres.js";

export default function filterRoutes(fastify) {
    fastify.get("/filters", async (request, reply) => {
        try {
            const { rows: subjects } = await db.query(
                'SELECT DISTINCT subject FROM "Resource" WHERE subject IS NOT NULL ORDER BY subject'
            );

            const { rows: examBoards } = await db.query(
                'SELECT DISTINCT "examBoard" FROM "Resource" WHERE "examBoard" IS NOT NULL ORDER BY "examBoard"'
            );

            const { rows: levels } = await db.query(
                'SELECT DISTINCT level FROM "Resource" WHERE level IS NOT NULL ORDER BY level'
            );

            const { rows: types } = await db.query(
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
}
