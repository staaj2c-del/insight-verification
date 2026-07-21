import { createServerFn } from "@tanstack/react-start";

/**
 * Resolve a dashboard session from the decoded `ibs` cookie value.
 * The loader reads the cookie from the raw request and passes the
 * session ID here — same pattern as index.tsx with getVerifySession.
 */
export const resolveDashboardSession = createServerFn({ method: "POST" })
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
      sessionId,
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
      accessToken: session.accessToken,
    };
  });

export const getDashboardGuilds = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "sessionId" in data) {
      return data as { sessionId: string | null };
    }
    return { sessionId: null };
  })
  .handler(async ({ data }) => {
    const { sessionId } = data;
    if (!sessionId) return [];
    const { getSession } = await import("@/server/session");
    const { fetchDiscordGuilds } = await import("@/server/discord");
    const session = await getSession(sessionId);
    if (!session) return [];
    return fetchDiscordGuilds(session.accessToken).catch(() => [] as {
      id: string;
      name: string;
      icon: string | null;
      owner: boolean;
      permissions: string;
      features: string[];
    }[]);
  });

/** IP-based session fallback for returning users without a cookie. */
export const getIpDashboardSession = createServerFn({ method: "POST" })
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

export const getDashboardKeys = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "sessionId" in data) {
      return data as { sessionId: string | null };
    }
    return { sessionId: null };
  })
  .handler(async ({ data }) => {
    const { sessionId } = data;
    if (!sessionId) return [];
    const { getSession } = await import("@/server/session");
    const { listApiKeysByOwner } = await import("@/server/mongo");
    const session = await getSession(sessionId);
    if (!session) return [];
    return listApiKeysByOwner(session.discordId);
  });

