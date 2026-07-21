import { createServerFn } from "@tanstack/react-start";

// ── Owner ────────────────────────────────────────────────────────────
const OWNER_DISCORD_ID = "1000225571466399814";

export function isOwner(discordId: string): boolean {
  return discordId === OWNER_DISCORD_ID;
}

function getEnvStaffIds(): string[] {
  return (process.env.STAFF_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Check if a Discord user is staff or owner. */
export async function isStaff(discordId: string): Promise<boolean> {
  if (isOwner(discordId)) return true;
  if (getEnvStaffIds().includes(discordId)) return true;
  const { getDb } = await import("@/server/mongo");
  const db = await getDb();
  const doc = await db.collection("staff_members").findOne({ discordId });
  return !!doc;
}

// ── Staff auth helper ─────────────────────────────────────────────
// Accepts optional sessionId (passed from loader via cookie parsing).
// Falls back to getCookie for client-side RPC calls (browser sends cookies).

async function resolveSessionId(passed?: string | null): Promise<string | null> {
  if (passed) return passed;
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    return getCookie("ibs") ?? null;
  } catch {
    return null;
  }
}

async function requireStaff(sessionId?: string | null) {
  const resolved = await resolveSessionId(sessionId);
  if (!resolved) throw new Error("Unauthorized");
  const { getSession } = await import("@/server/session");
  const session = await getSession(resolved);
  if (!session || !(await isStaff(session.discordId))) throw new Error("Unauthorized");
  return session;
}

async function requireOwner(sessionId?: string | null) {
  const session = await requireStaff(sessionId);
  if (!isOwner(session.discordId)) throw new Error("Owner only");
  return session;
}

// ── Server fn: get staff context + Roblox profile ─────────────────

export const getStaffContext = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "sessionId" in data) {
      return data as { sessionId: string | null };
    }
    return { sessionId: null };
  })
  .handler(async ({ data }) => {
    const { sessionId } = data;
    const resolved = await resolveSessionId(sessionId);
    if (!resolved) return null;
    const { getSession } = await import("@/server/session");
    const session = await getSession(resolved);
    if (!session || !(await isStaff(session.discordId))) return null;

    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const verif = await db.collection("verifications").findOne({ discordId: session.discordId });

    return {
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
      accessToken: session.accessToken,
      isOwner: isOwner(session.discordId),
      robloxUsername: verif?.robloxUsername ?? null,
      robloxId: verif?.robloxId ?? null,
      robloxDisplayName: verif?.robloxDisplayName ?? null,
    };
  });

/** Get all pending global key requests. */
export const getPendingGlobalKeys = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "sessionId" in data) {
      return data as { sessionId: string | null };
    }
    return { sessionId: null };
  })
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const docs = await db.collection("api_keys")
      .find({ type: "global", authorized: false, revoked: false })
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map((d) => ({
      key: d.key,
      ownerId: d.ownerId,
      ownerName: d.ownerName,
      label: d.label,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      guildId: d.guildId ?? null,
      guildName: d.guildName ?? null,
    }));
  });

/** Approve a global key. */
export const approveGlobalKey = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { key: string })
  .handler(async ({ data }) => {
    await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const result = await db.collection("api_keys").updateOne(
      { key: data.key, type: "global" },
      { $set: { authorized: true, authorizedAt: new Date() } },
    );
    return { ok: result.modifiedCount > 0 };
  });

/** Deny/revoke a global key. */
export const denyGlobalKey = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { key: string })
  .handler(async ({ data }) => {
    await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    await db.collection("api_keys").updateOne(
      { key: data.key },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
    return { ok: true };
  });

/** Get all verifications (paginated). */
export const getAllVerifications = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      return {
        page: typeof d.page === "number" ? d.page : 1,
        limit: typeof d.limit === "number" ? d.limit : 20,
        sessionId: typeof d.sessionId === "string" ? d.sessionId as string | null : null,
      };
    }
    return { page: 1, limit: 20, sessionId: null };
  })
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const skip = (data.page - 1) * data.limit;
    const [docs, total] = await Promise.all([
      db.collection("verifications")
        .find()
        .sort({ verifiedAt: -1 })
        .skip(skip)
        .limit(data.limit)
        .toArray(),
      db.collection("verifications").countDocuments(),
    ]);
    return {
      docs: docs.map((d) => ({
        discordId: String(d.discordId),
        robloxId: String(d.robloxId),
        robloxUsername: String(d.robloxUsername),
        robloxDisplayName: d.robloxDisplayName ? String(d.robloxDisplayName) : null,
        verifiedAt: d.verifiedAt instanceof Date ? d.verifiedAt.toISOString() : String(d.verifiedAt ?? ""),
        updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt ?? ""),
      })),
      total,
    };
  });

/** Get verification by Discord ID. */
export const getVerificationByDiscordId = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { discordId: string })
  .handler(async ({ data }) => {
    await requireStaff();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const verif = await db.collection("verifications").findOne({ discordId: data.discordId });
    return verif
      ? { robloxUsername: verif.robloxUsername, robloxId: verif.robloxId, robloxDisplayName: verif.robloxDisplayName ?? null }
      : null;
  });

// ── Owner-only: IP Lookup ────────────────────────────────────────────

export interface IpLookupResult {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  ip: string;
  lastSeen: string;
  sessionCount: number;
  robloxUsername: string | null;
  robloxId: string | null;
  robloxDisplayName: string | null;
}

/** Owner-only: Lookup IP(s) by Discord ID or Roblox ID. */
export const lookupUserIps = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { query: string })
  .handler(async ({ data }) => {
    await requireOwner();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const q = data.query.trim();

    const isNumeric = /^\d+$/.test(q);
    let discordIds: string[] = [];

    if (isNumeric) {
      if (q.length >= 17) {
        discordIds = [q];
      } else {
        const verifs = await db.collection("verifications")
          .find({ robloxId: q })
          .project({ discordId: 1 })
          .toArray();
        discordIds = verifs.map(v => v.discordId);
      }
    } else {
      const verifs = await db.collection("verifications")
        .find({ robloxUsername: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" } })
        .project({ discordId: 1 })
        .toArray();
      discordIds = verifs.map(v => v.discordId);
    }

    if (discordIds.length === 0) return [] as IpLookupResult[];

    const ipDocs = await db.collection("ip_sessions")
      .find({ discordId: { $in: discordIds } })
      .sort({ lastSeen: -1 })
      .toArray();

    const results: IpLookupResult[] = [];
    for (const ipDoc of ipDocs) {
      const verif = await db.collection("verifications").findOne({ discordId: ipDoc.discordId });
      results.push({
        discordId: ipDoc.discordId,
        discordUsername: ipDoc.discordUsername,
        discordAvatar: ipDoc.discordAvatar ?? null,
        ip: ipDoc.ip,
        lastSeen: ipDoc.lastSeen instanceof Date ? ipDoc.lastSeen.toISOString() : String(ipDoc.lastSeen),
        sessionCount: ipDoc.sessionCount ?? 0,
        robloxUsername: verif?.robloxUsername ?? null,
        robloxId: verif?.robloxId ?? null,
        robloxDisplayName: verif?.robloxDisplayName ?? null,
      });
    }
    return results;
  });

// ── Owner-only: Staff Management ─────────────────────────────────────

export interface StaffMember {
  discordId: string;
  addedBy: string;
  addedAt: string;
}

/** Get all staff members from DB. Owner can see the list. */
export const getStaffMembers = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireOwner();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const docs = await db.collection("staff_members").find().sort({ addedAt: -1 }).toArray();
    return docs.map(d => ({
      discordId: d.discordId,
      addedBy: d.addedBy,
      addedAt: d.addedAt instanceof Date ? d.addedAt.toISOString() : String(d.addedAt),
    })) as StaffMember[];
  });

/** Owner-only: add a staff member by Discord ID. */
export const addStaffMember = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { discordId: string })
  .handler(async ({ data }) => {
    const session = await requireOwner();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    await db.collection("staff_members").updateOne(
      { discordId: data.discordId },
      {
        $set: {
          discordId: data.discordId,
          addedBy: session.discordUsername,
          addedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { ok: true };
  });

/** Owner-only: remove a staff member by Discord ID. */
export const removeStaffMember = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { discordId: string })
  .handler(async ({ data }) => {
    await requireOwner();
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    await db.collection("staff_members").deleteOne({ discordId: data.discordId });
    return { ok: true };
  });

// ── Blacklist system ────────────────────────────────────────────────

export interface BlacklistEntry {
  type: "discordId" | "ip";
  value: string;
  reason: string;
  addedBy: string;
  addedAt: string;
}

/** Get all blacklist entries. */
export const getBlacklists = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data === "object" && data !== null && "sessionId" in data) {
      return data as { sessionId: string | null };
    }
    return { sessionId: null };
  })
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { getDb } = await import("@/server/mongo");
    const db = await getDb();
    const docs = await db.collection("blacklist")
      .find()
      .sort({ addedAt: -1 })
      .toArray();
    return docs.map((d) => ({
      type: String(d.type),
      value: String(d.value),
      reason: String(d.reason),
      addedBy: String(d.addedBy),
      addedAt: d.addedAt instanceof Date ? d.addedAt.toISOString() : String(d.addedAt),
    })) as BlacklistEntry[];
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


