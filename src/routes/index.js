import searchRoutes from "./search.js";
import filterRoutes from "./filters.js";
import adminRoutes from "./admin.js";

export default function registerRoutes(fastify) {
    searchRoutes(fastify);
    filterRoutes(fastify);
    adminRoutes(fastify);
}
