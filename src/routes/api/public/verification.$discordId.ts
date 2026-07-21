import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { verifications } from "@/server/mongo";

// GET  /api/public/verification/:discordId  → lookup (bot pulls verified data)
// DELETE /api/public/verification/:discordId → unverify
// Auth: Authorization: Bearer <BOT_API_KEY>
export const Route = createFileRoute("/api/public/verification/$discordId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authError = requireBotAuth(request);
        if (authError) return authError;

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
        const authError = requireBotAuth(request);
        if (authError) return authError;
        const col = await verifications();
        const r = await col.deleteOne({ discordId: params.discordId });
        return json({ deleted: r.deletedCount });
      },
    },
  },
});

function requireBotAuth(request: Request): Response | null {
  const expected = process.env.BOT_API_KEY;
  if (!expected) return json({ error: "server_not_configured" }, 500);
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token || !timingSafeEqual(token, expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
