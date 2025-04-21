export default function adminRoutes(fastify) {
    // Health check endpoint
    fastify.get("/health", async () => {
        return { status: "ok" };
    });
}
