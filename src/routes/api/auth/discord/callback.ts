import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { exchangeDiscordCode, fetchDiscordUser } from "@/server/discord";
import { createSession, setSessionCookie } from "@/server/session";

// GET /api/auth/discord/callback?code=...&state=...
// Discord redirects here after the user authorizes.
export const Route = createFileRoute("/api/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${url.origin}/dashboard?error=${encodeURIComponent(error)}` },
          });
        }

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${url.origin}/dashboard?error=missing_code` },
          });
        }

        try {
          const redirectUri = `${url.origin}/api/auth/discord/callback`;
          const token = await exchangeDiscordCode(code, redirectUri);
          const user = await fetchDiscordUser(token.access_token);

          const sessionId = await createSession({
            discordId: user.id,
            discordUsername: user.global_name ?? user.username,
            discordAvatar: user.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
              : null,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
          });

          return new Response(null, {
            status: 302,
            headers: {
              Location: `${url.origin}/dashboard`,
              "Set-Cookie": setSessionCookie(sessionId, 7 * 24 * 60 * 60),
            },
          });
        } catch (e) {
          console.error("Discord OAuth callback error:", e);
          return new Response(null, {
            status: 302,
            headers: { Location: `${url.origin}/dashboard?error=auth_failed` },
          });
        }
      },
    },
  },
});

