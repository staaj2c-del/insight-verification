import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionIdFromRequest, deleteSession, clearSessionCookie } from "@/server/session";

// GET /api/auth/discord/logout
export const Route = createFileRoute("/api/auth/discord/logout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = getSessionIdFromRequest(request);
        if (sessionId) {
          await deleteSession(sessionId).catch(() => {});
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${url.origin}/dashboard`,
            "Set-Cookie": clearSessionCookie(),
          },
        });
      },
    },
  },
});

