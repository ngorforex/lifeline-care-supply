export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      try {
        if (!env.DB) throw new Error("D1 binding is missing");
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        if (result?.ok !== 1) throw new Error("D1 health query failed");
        return Response.json({
          status: "ok",
          service: "lifeline-care-supply",
          database: "connected",
          environment: "production"
        }, {
          headers: { "cache-control": "no-store" }
        });
      } catch {
        return Response.json({
          status: "degraded",
          service: "lifeline-care-supply",
          database: "unavailable"
        }, {
          status: 503,
          headers: { "cache-control": "no-store" }
        });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "API route not implemented yet." }, {
        status: 404,
        headers: { "cache-control": "no-store" }
      });
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);

    return new Response("Lifeline Care Supply is being prepared.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
