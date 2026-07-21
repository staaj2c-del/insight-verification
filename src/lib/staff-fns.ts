import { createServerFn } from "@tanstack/react-start";

function getStaffIds(): string[] {
  return (process.env.STAFF_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Check if a Discord user is a staff member. */
export function isStaff(discordId: string): boolean {
  return getStaffIds().includes(discordId);
}

// ── Staff auth helper (DRY the cookie+session+staff check) ────────
async function requireStaff() {
  const { getCookie } = await import("@tanstack/react-start/server");
  const sessionId = getCookie("ibs");
  if (!sessionId) throw new Error("Unauthorized");
  const { getSession } = await import("@/server/session");
  const session = await getSession(sessionId);
  if (!session || !isStaff(session.discordId)) throw new Error("Unauthorized");
  return session;
}

/** Server fn: get staff status + Roblox profile. */
export const getStaffContext = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const sessionId = getCookie("ibs");
    if (!sessionId) return null;
    const { getSession } = await import("@/server/session");
    const session = await getSession(sessionId);
    if (!session || !isStaff(session.discordId)) return null;

    // Also fetch their Roblox verification
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const verif = await db.collection("verifications").findOne({ discordId: session.discordId });

    return {
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
      accessToken: session.accessToken,
      robloxUsername: verif?.robloxUsername ?? null,
      robloxId: verif?.robloxId ?? null,
      robloxDisplayName: verif?.robloxDisplayName ?? null,
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
    const session = await requireStaff();
    const { authorizeGlobalKey } = await import("@/server/mongo");
    return authorizeGlobalKey(data.key, session.discordUsername);
  });

/** Get all verifications (paginated, searchable). */
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

/** Get Roblox info for a specific Discord user (from verification lookup). */
export const getUserRoblox = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { discordId: string })
  .handler(async ({ data }) => {
    const session = await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const verif = await db.collection("verifications").findOne({ discordId: data.discordId });
    return verif
      ? { robloxUsername: verif.robloxUsername, robloxId: verif.robloxId, robloxDisplayName: verif.robloxDisplayName ?? null }
      : null;
  });

// ── Blacklist system ────────────────────────────────────────────────

export interface BlacklistEntry {
  type: "discordId" | "ip";
  value: string;
  reason: string;
  addedBy: string;
  addedAt: Date;
}

/** Get all blacklist entries. */
export const getBlacklists = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    return db.collection("blacklist")
      .find()
      .sort({ addedAt: -1 })
      .toArray() as Promise<BlacklistEntry[]>;
  });

/** Blacklist a Discord user ID. */
export const blacklistDiscordId = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { discordId: string; reason: string })
  .handler(async ({ data }) => {
    const session = await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    await db.collection("blacklist").updateOne(
      { type: "discordId", value: data.discordId },
      {
        $set: {
          type: "discordId",
          value: data.discordId,
          reason: data.reason,
          addedBy: session.discordUsername,
          addedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { ok: true };
  });

/** Blacklist an IP address. */
export const blacklistIp = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { ip: string; reason: string })
  .handler(async ({ data }) => {
    const session = await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    await db.collection("blacklist").updateOne(
      { type: "ip", value: data.ip },
      {
        $set: {
          type: "ip",
          value: data.ip,
          reason: data.reason,
          addedBy: session.discordUsername,
          addedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { ok: true };
  });

/** Remove a blacklist entry. */
export const removeBlacklist = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { type: string; value: string })
  .handler(async ({ data }) => {
    await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    await db.collection("blacklist").deleteOne({ type: data.type, value: data.value });
    return { ok: true };
  });

/** Check if a Discord ID or IP is blacklisted (public, used by verify flow). */
export const checkBlacklisted = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { type?: string } | undefined)
  .handler(async () => {
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    return db.collection("blacklist").find().toArray() as Promise<BlacklistEntry[]>;
  });

/** Get site stats. */
export const getSiteStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const [verifications, apiKeys, tokens, blacklisted] = await Promise.all([
      db.collection("verifications").countDocuments(),
      db.collection("api_keys").countDocuments({ authorized: true, revoked: false }),
      db.collection("tokens").countDocuments({ used: true }),
      db.collection("blacklist").countDocuments(),
    ]);
    return { verifications, apiKeys, tokens, blacklisted };
  });

