import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { authorizeGlobalKey, listApiKeysByOwner, type ApiKey } from "@/server/mongo";
import { getSession, getSessionIdFromRequest } from "@/server/session";
import { getDb } from "@/server/mongo";

// POST /api/public/keys/authorize
// Staff endpoint to approve pending global API keys.
// Requires dashboard session AND membership in STAFF_DISCORD_IDS.
export const Route = createFileRoute("/api/public/keys/authorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Check session
        const sessionId = getSessionIdFromRequest(request);
        const session = await getSession(sessionId ?? "");
        if (!session) return json({ error: "Not logged in" }, 401);

        // Check staff
        const staffIds = (process.env.STAFF_DISCORD_IDS ?? "").split(",").map((s) => s.trim());
        if (!staffIds.includes(session.discordId)) {
          return json({ error: "Staff only" }, 403);
        }

        let body: { key?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        if (!body.key) return json({ error: "key is required" }, 400);

        const ok = await authorizeGlobalKey(body.key, session.discordId);
        if (!ok) return json({ error: "Key not found or already authorized" }, 404);

        return json({ authorized: true });
      },

      // GET — list all pending global keys (staff only)
      GET: async ({ request }) => {
        const sessionId = getSessionIdFromRequest(request);
        const session = await getSession(sessionId ?? "");
        if (!session) return json({ error: "Not logged in" }, 401);

        const staffIds = (process.env.STAFF_DISCORD_IDS ?? "").split(",").map((s) => s.trim());
        if (!staffIds.includes(session.discordId)) {
          return json({ error: "Staff only" }, 403);
        }

        const db = await getDb();
        const col = db.collection("api_keys");
        const pending = await col
          .find({ type: "global", authorized: false, revoked: false })
          .sort({ createdAt: -1 })
          .toArray();

        return json({
          pending: pending.map((k) => ({
            key: k.key,
            ownerId: k.ownerId,
            ownerName: k.ownerName,
            label: k.label,
            createdAt: k.createdAt,
          })),
        });
      },
    },
  },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

