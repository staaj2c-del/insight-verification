// Session management with IP-based persistent login.
// - Primary: HttpOnly `ibs` cookie (session ID → MongoDB)
// - Persistent: IP → Discord ID mapping in MongoDB for returning users
import { getDb } from "./mongo";
import type { Collection } from "mongodb";

export interface DashboardSession {
  sessionId: string;
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IpSession {
  ip: string;
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  lastSeen: Date;
  sessionCount: number;
}

export async function sessionsCol(): Promise<Collection<DashboardSession>> {
  const db = await getDb();
  const col = db.collection<DashboardSession>("dashboard_sessions");
  await col.createIndex({ sessionId: 1 }, { unique: true }).catch(() => {});
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  return col;
}

export async function ipSessionsCol(): Promise<Collection<IpSession>> {
  const db = await getDb();
  const col = db.collection<IpSession>("ip_sessions");
  await col.createIndex({ ip: 1 }, { unique: true }).catch(() => {});
  await col.createIndex({ discordId: 1 }).catch(() => {});
  return col;
}

export async function createSession(user: {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  accessToken?: string;
  refreshToken?: string;
}): Promise<string> {
  const crypto = await import("crypto");
  const sessionId = crypto.randomUUID();
  const col = await sessionsCol();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await col.insertOne({
    sessionId,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    discordAvatar: user.discordAvatar,
    accessToken: user.accessToken ?? "",
    refreshToken: user.refreshToken ?? "",
    expiresAt,
    createdAt: new Date(),
  });

  return sessionId;
}

export async function saveIpSession(ip: string, user: {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
}): Promise<void> {
  const col = await ipSessionsCol();
  await col.updateOne(
    { ip },
    {
      $set: {
        discordId: user.discordId,
        discordUsername: user.discordUsername,
        discordAvatar: user.discordAvatar,
        lastSeen: new Date(),
      },
      $inc: { sessionCount: 1 },
    },
    { upsert: true },
  );
}

/** Look up a returning user by IP. Returns null if no match in last 30 days. */
export async function getSessionByIp(ip: string): Promise<{
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
} | null> {
  const col = await ipSessionsCol();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const doc = await col.findOne({ ip, lastSeen: { $gte: cutoff } });
  if (!doc) return null;
  await col.updateOne({ ip }, { $set: { lastSeen: new Date() } }).catch(() => {});
  return {
    discordId: doc.discordId,
    discordUsername: doc.discordUsername,
    discordAvatar: doc.discordAvatar,
  };
}

export async function getSession(sessionId: string): Promise<DashboardSession | null> {
  if (!sessionId) return null;
  const col = await sessionsCol();
  const doc = await col.findOne({ sessionId, expiresAt: { $gt: new Date() } });
  if (!doc) return null;
  return doc;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const col = await sessionsCol();
  await col.deleteOne({ sessionId });
}

export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("ibs="));
  if (!match) return null;
  return decodeURIComponent(match.slice("ibs=".length));
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "0.0.0.0";
}

export function setSessionCookie(sessionId: string, maxAge: number): string {
  return `ibs=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `ibs=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}



