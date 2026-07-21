import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { verifications } from "@/server/mongo";
import { authenticateApiKey } from "@/server/auth";

// GET  /api/public/verification/:discordId  → lookup (bot pulls verified data)
// DELETE /api/public/verification/:discordId → unverify
//
// Auth:
//   Authorization: Bearer insight_server_xxx  (developer server key)
//   Authorization: Bearer insight_global_xxx   (developer global key)
//   Authorization: Bearer <BOT_API_KEY>        (legacy env var)
export const Route = createFileRoute("/api/public/verification/$discordId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) {
          return json({ error: "unauthorized" }, 401);
        }

        const col = await verifications();
        const doc = await col.findOne({ discordId: params.discordId });
        if (!doc) return json({ verified: false }, 404);

        return json({
          verified: true,
          discordId: doc.discordId,
          robloxId: doc.robloxId,
          robloxUsername: doc.robloxUsername,
          robloxDisplayName: doc.robloxDisplayName ?? null,
          verifiedAt: doc.verifiedAt,
          updatedAt: doc.updatedAt,
        });
      },
      DELETE: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) {
          return json({ error: "unauthorized" }, 401);
        }

        const col = await verifications();
        const r = await col.deleteOne({ discordId: params.discordId });
        return json({ deleted: r.deletedCount });
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

