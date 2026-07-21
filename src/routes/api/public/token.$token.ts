import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { resolveToken } from "@/server/mongo";

// GET /api/public/token/:token
// Frontend calls this to validate a token and get the associated discord_id.
export const Route = createFileRoute("/api/public/token/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { token } = params as { token: string };

        if (!token) {
          return Response.json({ error: "Token required" }, { status: 400 });
        }

        try {
          const discordId = await resolveToken(token);
          if (!discordId) {
            return Response.json({ error: "Invalid or expired token" }, { status: 404 });
          }
          return Response.json({ discord_id: discordId });
        } catch (e) {
          console.error("Failed to resolve token:", e);
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});

