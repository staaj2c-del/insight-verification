import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

// GET /api/auth/discord/start
// Redirects the user to Discord's OAuth2 authorize page.
// After authorization, Discord redirects to /api/auth/discord/callback.
export const Route = createFileRoute("/api/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) return new Response("Discord OAuth not configured", { status: 500 });

        const url = new URL(request.url);
        const redirectUri = `${url.origin}/api/auth/discord/callback`;

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "identify guilds",
        });

        return new Response(null, {
          status: 302,
          headers: { Location: `https://discord.com/oauth2/authorize?${params}` },
        });
      },
    },
  },
});

