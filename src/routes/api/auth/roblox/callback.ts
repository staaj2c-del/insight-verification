import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { exchangeCode, fetchUserInfo } from "@/server/roblox";
import { verifications, consumeToken } from "@/server/mongo";

// GET /api/auth/roblox/callback?code=...&state=<discordId>.<nonce>.<verifyToken>
export const Route = createFileRoute("/api/auth/roblox/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description") ?? "";

        if (err) {
          console.error("Roblox OAuth error:", err, errorDesc);
          return redirectTo(url.origin, `/verify/error?reason=${encodeURIComponent(err)}`);
        }
        if (!code || !state) return redirectTo(url.origin, "/verify/error?reason=missing_params");

        // Verify state matches the cookie we set in /start
        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("rbx_state="))
          ?.slice("rbx_state=".length);
        if (!cookieState || decodeURIComponent(cookieState) !== state) {
          console.error("State mismatch — cookie:", cookieState, "param:", state);
          return redirectTo(url.origin, "/verify/error?reason=state_mismatch");
        }

        const [discordId, , verifyToken] = state.split(".");
        if (!discordId) return redirectTo(url.origin, "/verify/error?reason=bad_state");

        const clientId = process.env.ROBLOX_CLIENT_ID;
        const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          console.error("Missing ROBLOX_CLIENT_ID or ROBLOX_CLIENT_SECRET");
          return redirectTo(url.origin, "/verify/error?reason=server_config");
        }

        const redirectUri = `${url.origin}/api/auth/roblox/callback`;

        try {
          const token = await exchangeCode({
            clientId,
            clientSecret,
            code,
            redirectUri,
          });
          const info = await fetchUserInfo(token.access_token);

          if (!info.sub) {
            console.error("Roblox userinfo missing sub:", JSON.stringify(info));
            return redirectTo(url.origin, "/verify/error?reason=oauth_failed");
          }

          const now = new Date();
          const col = await verifications();
          await col.updateOne(
            { discordId },
            {
              $set: {
                robloxId: info.sub,
                robloxUsername: info.preferred_username ?? info.nickname ?? info.name ?? "",
                robloxDisplayName: info.name,
                updatedAt: now,
              },
              $setOnInsert: {
                discordId,
                verifiedAt: now,
              },
            },
            { upsert: true },
          );

          if (verifyToken) {
            await consumeToken(verifyToken).catch(() => {});
          }

          const params = new URLSearchParams({
            u: info.preferred_username ?? info.nickname ?? info.name ?? "",
            id: info.sub,
          });
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/verify/success?${params.toString()}`,
              "Set-Cookie": `rbx_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Roblox verification failed:", msg);
          return redirectTo(url.origin, "/verify/error?reason=oauth_failed");
        }
      },
    },
  },
});

function redirectTo(origin: string, path: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${origin}${path}` } });
}

