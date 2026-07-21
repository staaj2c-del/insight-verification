import { createServerFn } from "@tanstack/react-start";

/** Check Discord login session from the verify landing page. */
export const getVerifySession = createServerFn({ method: "GET" }).handler(
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
    };
  },
);

