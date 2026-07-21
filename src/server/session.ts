// Simple encrypted session cookie for the dashboard.
// Uses a random session ID stored in MongoDB → HttpOnly cookie.
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

export async function sessionsCol(): Promise<Collection<DashboardSession>> {
  const db = await getDb();
  const col = db.collection<DashboardSession>("dashboard_sessions");
  await col.createIndex({ sessionId: 1 }, { unique: true }).catch(() => {});
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  return col;
}

export async function createSession(user: {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  accessToken: string;
  refreshToken: string;
}): Promise<string> {
  const crypto = await import("crypto");
  const sessionId = crypto.randomUUID();
  const col = await sessionsCol();

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await col.insertOne({
    sessionId,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    discordAvatar: user.discordAvatar,
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
    expiresAt,
    createdAt: new Date(),
  });

  return sessionId;
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

/** Parse session from the request cookie. */
export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("ibs="));
  if (!match) return null;
  return decodeURIComponent(match.slice("ibs=".length));
}

/** Set the session cookie header value. */
export function setSessionCookie(sessionId: string, maxAge: number): string {
  return `ibs=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `ibs=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

