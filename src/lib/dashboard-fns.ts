import { createServerFn } from "@tanstack/react-start";

export const getDashboardSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getSession, getSessionIdFromRequest } = await import("@/server/session");
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const request = getWebRequest();
    if (!request) return null;
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) return null;
    const session = await getSession(sessionId);
    if (!session) return null;
    return {
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
      accessToken: session.accessToken,
    };
  },
);

export const getDashboardGuilds = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getSession, getSessionIdFromRequest } = await import("@/server/session");
    const { fetchDiscordGuilds } = await import("@/server/discord");
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const request = getWebRequest();
    if (!request) return [];
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) return [];
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
  },
);

export const getDashboardKeys = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getSession, getSessionIdFromRequest } = await import("@/server/session");
    const { listApiKeysByOwner } = await import("@/server/mongo");
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const request = getWebRequest();
    if (!request) return [];
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) return [];
    const session = await getSession(sessionId);
    if (!session) return [];
    return listApiKeysByOwner(session.discordId);
  },
);

