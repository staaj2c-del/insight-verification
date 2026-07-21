import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { buildAuthorizeUrl } from "@/server/roblox";

// GET /api/auth/roblox/start?discord_id=123456789012345678
// Sets a short-lived signed state cookie that carries the Discord ID and a nonce,
// then 302s to Roblox's authorize endpoint.
export const Route = createFileRoute("/api/auth/roblox/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const discordId = url.searchParams.get("discord_id");
        if (!discordId || !/^\d{5,25}$/.test(discordId)) {
          return new Response("Missing or invalid discord_id", { status: 400 });
        }

        const clientId = process.env.ROBLOX_CLIENT_ID;
        if (!clientId) return new Response("Server not configured", { status: 500 });

        const nonce = crypto.randomUUID();
        const state = `${discordId}.${nonce}`;

        const redirectUri = `${url.origin}/api/auth/roblox/callback`;
        const authorizeUrl = buildAuthorizeUrl({
          clientId,
          redirectUri,
          state,
          scope: "openid profile",
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: authorizeUrl,
            "Set-Cookie": `rbx_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      },
    },
  },
});
