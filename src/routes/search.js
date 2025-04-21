import { getIndex } from "../services/meilisearch.js";

export default function searchRoutes(fastify) {
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
                sort = "averageRating:desc",
                fuzzy = "true",
            } = request.query;

            // Parse tags if provided
            const parsedTags = tags ? tags.toString().split(",") : [];

            // Build search parameters
            const searchParams = {
                limit: parseInt(limit.toString()),
                offset: parseInt(offset.toString()),
            };

            // Configure fuzzy search parameters
            const isFuzzy = fuzzy.toString() === "true";
            if (isFuzzy) {
                searchParams.matchingStrategy = "all";
            } else {
                searchParams.matchingStrategy = "last";
            }

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

            // Add sorting - use provided sort parameter or default to averageRating:desc
            const sortParam = sort || "averageRating:desc";
            const [field, direction] = sortParam.toString().split(":");
            if (field && (direction === "asc" || direction === "desc")) {
                searchParams.sort = [`${field}:${direction}`];
            } else {
                // Fallback to default sort if invalid sort parameter
                searchParams.sort = ["averageRating:desc"];
            }

            // Perform the search
            const index = getIndex();
            const searchResults = await index.search(
                query.toString(),
                searchParams
            );

            return {
                hits: searchResults.hits,
                totalHits: searchResults.estimatedTotalHits,
                processingTimeMs: searchResults.processingTimeMs,
                fuzzyEnabled: isFuzzy,
            };
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                error: "An error occurred while searching",
                message: error.message,
            });
        }
    });
}
