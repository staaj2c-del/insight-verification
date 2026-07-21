// Server-only MongoDB client. Uses raw TCP; requires a Node runtime (Vercel).
// Will NOT work on Cloudflare Workers preview.
import { MongoClient, type Db, type Collection } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  // Uses default db from the connection string; falls back to "insightbot".
  return client.db(process.env.MONGODB_DB || undefined);
}

export interface VerificationRecord {
  discordId: string;
  robloxId: string;
  robloxUsername: string;
  robloxDisplayName?: string;
  verifiedAt: Date;
  updatedAt: Date;
}

export async function verifications(): Promise<Collection<VerificationRecord>> {
  const db = await getDb();
  const col = db.collection<VerificationRecord>("verifications");

  // Drop stale unique index on "token" from older deployments — it conflicts
  // with upserts that don't set a token field (E11000 dup key: { token: null }).
  try {
    await col.dropIndex("token_1");
  } catch {
    // Index doesn't exist — fine.
  }

  // Also drop any old non-unique token index
  try {
    await col.dropIndex("token_1_unique");
  } catch {
    // Doesn't exist — fine.
  }

  await Promise.all([
    col.createIndex({ discordId: 1 }, { unique: true }),
    col.createIndex({ robloxId: 1 }, { unique: true }),
  ]).catch(() => {});
  return col;
}

export interface VerificationToken {
  token: string;
  discordId: string;
  createdAt: Date;
  used: boolean;
  usedAt?: Date;
}

export async function tokens(): Promise<Collection<VerificationToken>> {
  const db = await getDb();
  const col = db.collection<VerificationToken>("tokens");
  await col.createIndex({ token: 1 }, { unique: true }).catch(() => {});
  await col.createIndex({ discordId: 1 }).catch(() => {});
  return col;
}

export async function createToken(discordId: string): Promise<string> {
  const crypto = await import("crypto");
  const token = crypto.randomUUID();
  const col = await tokens();
  await col.insertOne({
    token,
    discordId,
    createdAt: new Date(),
    used: false,
  });
  return token;
}

export async function resolveToken(token: string): Promise<string | null> {
  const col = await tokens();
  const doc = await col.findOne({ token, used: false });
  if (!doc) return null;
  return doc.discordId;
}

export async function consumeToken(token: string): Promise<boolean> {
  const col = await tokens();
  const r = await col.updateOne(
    { token, used: false },
    { $set: { used: true, usedAt: new Date() } },
  );
  return r.modifiedCount > 0;
}

// ── Developer API Keys ──────────────────────────────────────────────

export interface ApiKey {
  key: string;
  type: "server" | "global";
  ownerId: string;
  ownerName: string;
  guildId: string | null;
  guildName: string | null;
  label: string;
  createdAt: Date;
  authorized: boolean; // global keys need staff approval
  authorizedBy: string | null;
  authorizedAt: Date | null;
  lastUsed: Date | null;
  revoked: boolean;
}

export async function apiKeys(): Promise<Collection<ApiKey>> {
  const db = await getDb();
  const col = db.collection<ApiKey>("api_keys");
  await col.createIndex({ key: 1 }, { unique: true }).catch(() => {});
  await col.createIndex({ ownerId: 1 }).catch(() => {});
  await col.createIndex({ guildId: 1 }).catch(() => {});
  return col;
}

export async function createApiKey(params: {
  type: "server" | "global";
  ownerId: string;
  ownerName: string;
  guildId: string | null;
  guildName: string | null;
  label: string;
}): Promise<string> {
  const crypto = await import("crypto");
  const prefix = params.type === "global" ? "insight_global_" : "insight_server_";
  const key = prefix + crypto.randomBytes(24).toString("hex");
  const col = await apiKeys();
  await col.insertOne({
    key,
    type: params.type,
    ownerId: params.ownerId,
    ownerName: params.ownerName,
    guildId: params.guildId,
    guildName: params.guildName,
    label: params.label,
    createdAt: new Date(),
    authorized: params.type === "server", // server keys auto-authorized, global needs staff
    authorizedBy: null,
    authorizedAt: params.type === "server" ? new Date() : null,
    lastUsed: null,
    revoked: false,
  });
  return key;
}

export async function validateApiKey(key: string): Promise<ApiKey | null> {
  const col = await apiKeys();
  const doc = await col.findOne({ key, authorized: true, revoked: false });
  if (!doc) return null;
  // Update lastUsed
  await col.updateOne({ key }, { $set: { lastUsed: new Date() } }).catch(() => {});
  return doc;
}

export async function listApiKeysByOwner(ownerId: string): Promise<ApiKey[]> {
  const col = await apiKeys();
  return col.find({ ownerId, revoked: false }).sort({ createdAt: -1 }).toArray();
}

export async function revokeApiKey(key: string, ownerId: string): Promise<boolean> {
  const col = await apiKeys();
  const r = await col.updateOne({ key, ownerId }, { $set: { revoked: true } });
  return r.modifiedCount > 0;
}

export async function authorizeGlobalKey(
  key: string,
  authorizedBy: string,
): Promise<boolean> {
  const col = await apiKeys();
  const r = await col.updateOne(
    { key, type: "global", revoked: false },
    { $set: { authorized: true, authorizedBy, authorizedAt: new Date() } },
  );
  return r.modifiedCount > 0;
}


