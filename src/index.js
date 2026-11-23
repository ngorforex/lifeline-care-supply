export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "lifeline-care-supply"
      });
    }

    return new Response(
      "Lifeline Care Supply is online. Website setup is in progress.",
      {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
};
