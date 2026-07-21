import { createServerFn } from "@tanstack/react-start";

/**
 * Resolve a dashboard session by its session ID.
 * The loader parses the `ibs` cookie from the incoming request and passes
 * the decoded session ID here. We avoid `getWebRequest()` because it is
 * not available on the Vercel serverless runtime.
 */
export const getDashboardSession = createServerFn({ method: "POST" })
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

