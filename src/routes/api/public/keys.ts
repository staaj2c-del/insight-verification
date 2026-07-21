import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createApiKey, listApiKeysByOwner, revokeApiKey } from "@/server/mongo";
import { getSession, getSessionIdFromRequest } from "@/server/session";

// POST /api/public/keys — create a new developer API key
// GET  /api/public/keys — list your keys
// DELETE /api/public/keys — revoke a key (send { key } in body)
//
// All endpoints require a valid dashboard session cookie.
export const Route = createFileRoute("/api/public/keys")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sessionId = getSessionIdFromRequest(request);
        const session = await getSession(sessionId ?? "");
        if (!session) return json({ error: "Not logged in" }, 401);

        let body: {
          type?: string;
          guildId?: string | null;
          guildName?: string | null;
          label?: string;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const type = body.type === "global" ? "global" : "server";
        if (type === "global" && !process.env.STAFF_DISCORD_IDS) {
          return json({ error: "Global key requests are not enabled" }, 400);
        }

        if (!body.label?.trim()) {
          return json({ error: "Label is required" }, 400);
        }

        try {
          const key = await createApiKey({
            type,
            ownerId: session.discordId,
            ownerName: session.discordUsername,
            guildId: body.guildId ?? null,
            guildName: body.guildName ?? null,
            label: body.label.trim(),
          });

          const status = type === "global" ? "pending_approval" : "active";
          return json({
            key,
            type,
            status,
            message:
              type === "global"
                ? "Global key created! It will become active after staff approval."
                : "Server key created! Use the Authorization: Bearer header with this key.",
          }, 201);
        } catch (e) {
          console.error("Failed to create API key:", e);
          return json({ error: "Internal error" }, 500);
        }
      },

      GET: async ({ request }) => {
        const sessionId = getSessionIdFromRequest(request);
        const session = await getSession(sessionId ?? "");
        if (!session) return json({ error: "Not logged in" }, 401);

        const keys = await listApiKeysByOwner(session.discordId);
        return json({
          keys: keys.map((k) => ({
            key: k.key.slice(0, 8) + "..." + k.key.slice(-8),
            fullKey: k.key,
            type: k.type,
            guildId: k.guildId,
            guildName: k.guildName,
            label: k.label,
            authorized: k.authorized,
            createdAt: k.createdAt,
            lastUsed: k.lastUsed,
          })),
        });
      },

      DELETE: async ({ request }) => {
        const sessionId = getSessionIdFromRequest(request);
        const session = await getSession(sessionId ?? "");
        if (!session) return json({ error: "Not logged in" }, 401);

        let body: { key?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        if (!body.key) return json({ error: "key is required" }, 400);

        const revoked = await revokeApiKey(body.key, session.discordId);
        if (!revoked) return json({ error: "Key not found or already revoked" }, 404);
        return json({ revoked: true });
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

