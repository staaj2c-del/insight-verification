import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

// GET /api/auth/discord/start?redirect_to=/          → login for verification
// GET /api/auth/discord/start?redirect_to=/dashboard  → login for dashboard
// GET /api/auth/discord/start                         → defaults to /dashboard
//
// Redirects the user to Discord's OAuth2 authorize page.
// The `redirect_to` value is passed through the OAuth state parameter.
export const Route = createFileRoute("/api/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) return new Response("Discord OAuth not configured", { status: 500 });

        const url = new URL(request.url);
        const redirectTo = url.searchParams.get("redirect_to") || "/dashboard";
        const redirectUri = process.env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;

        // Encode redirect target + nonce in state to prevent CSRF
        const nonce = crypto.randomUUID();
        const state = encodeURIComponent(JSON.stringify({ redirect_to: redirectTo, nonce }));

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "identify guilds",
          state,
        });

        return new Response(null, {
          status: 302,
          headers: { Location: `https://discord.com/oauth2/authorize?${params}` },
        });
      },
    },
  },
});


