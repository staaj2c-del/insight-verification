import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createToken } from "@/server/mongo";
import { authenticateTokenCreation } from "@/server/auth";

// POST /api/public/tokens
// Bot calls this to generate a one-time verification token for a Discord user.
//
// Auth options (in priority order):
// 1. Authorization: Bearer insight_server_xxx or insight_global_xxx  (developer keys)
// 2. Authorization: Bearer <BOT_API_KEY>  (legacy)
// 3. Body: { "secret": "<API_SECRET>" }  (legacy shared secret)
export const Route = createFileRoute("/api/public/tokens")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { discord_id?: string; secret?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { discord_id: discordId } = body;

        // Authenticate via developer key, legacy Bearer, or body secret
        const auth = await authenticateTokenCreation(request, body);
        if (!auth) {
          return Response.json(
            { error: "Unauthorized. Provide a valid API key via Authorization: Bearer or a secret in the body." },
            { status: 401 },
          );
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

