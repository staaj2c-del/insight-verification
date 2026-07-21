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
  // Ensure unique indexes (idempotent).
  await Promise.all([
    col.createIndex({ discordId: 1 }, { unique: true }),
    col.createIndex({ robloxId: 1 }, { unique: true }),
  ]).catch(() => {});
  return col;
}
