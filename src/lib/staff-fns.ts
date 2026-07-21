import { createServerFn } from "@tanstack/react-start";

const STAFF_IDS = (process.env.STAFF_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Check if a Discord user is a staff member. */
export function isStaff(discordId: string): boolean {
  return STAFF_IDS.includes(discordId);
}

/** Server fn: get staff status + full data for the staff panel. */
export const getStaffContext = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const sessionId = getCookie("ibs");
    if (!sessionId) return null;

    const { getSession } = await import("@/server/session");
    const session = await getSession(sessionId);
    if (!session || !isStaff(session.discordId)) return null;

    return {
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
      accessToken: session.accessToken,
    };
  });

/** Get all pending global key requests. */
export const getPendingGlobalKeys = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const sessionId = getCookie("ibs");
    if (!sessionId) return [];
    const { getSession } = await import("@/server/session");
    const session = await getSession(sessionId);
    if (!session || !isStaff(session.discordId)) return [];
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    return db.collection("api_keys")
      .find({ type: "global", authorized: false, revoked: false })
      .sort({ createdAt: -1 })
      .toArray();
  });

/** Approve a global key request. */
export const approveGlobalKey = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { key: string })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const sessionId = getCookie("ibs");
    if (!sessionId) throw new Error("Unauthorized");
    const { getSession } = await import("@/server/session");
    const session = await getSession(sessionId);
    if (!session || !isStaff(session.discordId)) throw new Error("Unauthorized");
    const { authorizeGlobalKey } = await import("@/server/mongo");
    return authorizeGlobalKey(data.key, session.discordUsername);
  });

/** Get all verifications (paginated). */
export const getAllVerifications = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { page?: number; limit?: number; search?: string } | undefined)
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const sessionId = getCookie("ibs");
    if (!sessionId) return { docs: [], total: 0 };
    const { getSession } = await import("@/server/session");
    const session = await getSession(sessionId);
    if (!session || !isStaff(session.discordId)) return { docs: [], total: 0 };
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const page = data?.page ?? 1;
    const limit = Math.min(data?.limit ?? 20, 100);
    const search = data?.search?.trim();
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { discordId: { $regex: search, $options: "i" } },
        { robloxUsername: { $regex: search, $options: "i" } },
        { robloxId: { $regex: search, $options: "i" } },
      ];
    }
    const col = db.collection("verifications");
    const total = await col.countDocuments(query);
    const docs = await col.find(query).sort({ verifiedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    return { docs, total };
  });

/** Get site stats. */
export const getSiteStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const [verifications, apiKeys, tokens] = await Promise.all([
      db.collection("verifications").countDocuments(),
      db.collection("api_keys").countDocuments({ authorized: true, revoked: false }),
      db.collection("tokens").countDocuments({ used: true }),
    ]);
    return { verifications, apiKeys, tokens };
  });

