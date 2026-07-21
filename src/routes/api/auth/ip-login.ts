import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionByIp, createSession, setSessionCookie, getClientIp } from "@/server/session";

// GET /api/auth/ip-login?redirect_to=/dashboard
// Auto-login for returning users on the same IP.
// If the visitor's IP matches a previously registered IP session,
// create a real dashboard session, set the ibs cookie, and redirect.
export const Route = createFileRoute("/api/auth/ip-login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectTo = url.searchParams.get("redirect_to") || "/dashboard";
        const ip = getClientIp(request);

        if (ip === "0.0.0.0") {
          return new Response(null, {
            status: 302,
            headers: { Location: `${url.origin}${redirectTo}` },
          });
        }

        const ipSession = await getSessionByIp(ip);
        if (!ipSession) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${url.origin}${redirectTo}` },
          });
        }

        // Create a proper session for the IP-matched user.
        // accessToken is empty — Discord API calls won't work, but the
        // user gets past the login gate and can access the dashboard.
        const sessionId = await createSession({
          discordId: ipSession.discordId,
          discordUsername: ipSession.discordUsername,
          discordAvatar: ipSession.discordAvatar,
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: `${url.origin}${redirectTo}`,
            "Set-Cookie": setSessionCookie(sessionId, 7 * 24 * 60 * 60),
          },
        });
      },
    },
  },
});

