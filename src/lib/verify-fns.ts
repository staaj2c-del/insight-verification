import { createServerFn } from "@tanstack/react-start";

/**
 * Resolve a dashboard session by its session ID.
 * The loader parses the `ibs` cookie from the incoming request and passes
 * the decoded session ID here. We avoid `getWebRequest()` because it is
 * not available on the Vercel serverless runtime.
 */
export const getVerifySession = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "sessionId" in data) {
      return data as { sessionId: string | null };
    }
    return { sessionId: null };
  })
  .handler(async ({ data }) => {
    const { sessionId } = data;
    if (!sessionId) return null;
    const { getSession } = await import("@/server/session");
    const session = await getSession(sessionId);
    if (!session) return null;
    return {
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
    };
  });

/** Look up a returning user by IP when no session cookie exists. */
export const getIpSession = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "ip" in data) {
      return data as { ip: string };
    }
    return { ip: "0.0.0.0" };
  })
  .handler(async ({ data }) => {
    const { getSessionByIp } = await import("@/server/session");
    return getSessionByIp(data.ip);
  });


