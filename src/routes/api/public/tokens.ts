import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createToken } from "@/server/mongo";

// POST /api/public/tokens
// Bot calls this to generate a one-time verification token for a Discord user.
// Body: { discord_id: string, secret: string }
// The `secret` is a shared value only the bot knows.
export const Route = createFileRoute("/api/public/tokens")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SHARED_SECRET = process.env.API_SECRET;
        if (!SHARED_SECRET) {
          return Response.json({ error: "Server not configured" }, { status: 500 });
        }

        let body: { discord_id?: string; secret?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { discord_id: discordId, secret } = body;

        if (!secret || secret !== SHARED_SECRET) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!discordId || !/^\d{5,25}$/.test(discordId)) {
          return Response.json({ error: "Valid discord_id required" }, { status: 400 });
        }

        try {
          const token = await createToken(discordId);
          const origin = new URL(request.url).origin;
          return Response.json({
            token,
            verify_url: `${origin}/?token=${encodeURIComponent(token)}`,
          });
        } catch (e) {
          console.error("Failed to create token:", e);
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});

