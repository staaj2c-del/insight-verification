// Shared authentication for public API endpoints.
// Supports both legacy env-var secrets AND the new developer API key system.

import { validateApiKey, type ApiKey, getDb } from "./mongo";

export interface AuthResult {
  key: ApiKey | null;
  /** Legacy env-var match. null if a developer key was used. */
  legacy: string | null;
}

/**
 * Validate an incoming request against either:
 * 1. The new developer API key system (Authorization: Bearer insight_server_* / insight_global_*)
 * 2. Legacy BOT_API_KEY env var (for verification lookup)
 * 3. Legacy API_SECRET env var (for token creation)
 *
 * Returns the authenticated context or null if unauthorized.
 */
export async function authenticateApiKey(request: Request): Promise<AuthResult | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  // 1. Check for new-style developer API keys
  if (token.startsWith("insight_server_") || token.startsWith("insight_global_")) {
    const key = await validateApiKey(token);
    if (key) return { key, legacy: null };
    return null; // key found but not authorized/revoked
  }

  // 2. Check legacy BOT_API_KEY
  if (token && process.env.BOT_API_KEY) {
    if (timingSafeEqual(token, process.env.BOT_API_KEY)) {
      return { key: null, legacy: "bot_api_key" };
    }
  }

  return null;
}

/**
 * Validate the API_SECRET from the request body (used by POST /api/public/tokens).
 * This is the shared secret the bot sends in the JSON body, NOT a bearer token.
 */
export function validateSecret(body: { secret?: string }): boolean {
  const expected = process.env.API_SECRET;
  if (!expected) return false;
  return timingSafeEqual(body.secret ?? "", expected);
}

/**
 * Validate a request that can use EITHER:
 * - Bearer token (dev key or legacy BOT_API_KEY), OR
 * - Legacy API_SECRET in body
 */
export async function authenticateTokenCreation(
  request: Request,
  body: { secret?: string },
): Promise<AuthResult | null> {
  // First try Bearer auth (developer keys)
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  if (token.startsWith("insight_server_") || token.startsWith("insight_global_")) {
    const key = await validateApiKey(token);
    if (key) return { key, legacy: null };
    return null;
  }

  // Legacy BOT_API_KEY
  if (token && process.env.BOT_API_KEY && timingSafeEqual(token, process.env.BOT_API_KEY)) {
    return { key: null, legacy: "bot_api_key" };
  }

  // Legacy API_SECRET in body
  if (validateSecret(body)) {
    return { key: null, legacy: "api_secret" };
  }

  return null;
}

/**
 * Check if a dev API key is scoped to a specific guild, and whether the
 * requested discord_id's verification data belongs to that guild.
 *
 * For server-scoped keys, we also verify the discordId belongs to the key's guild.
 * This requires a guild-membership lookup against the bot's Discord gateway.
 * For simplicity in v1, server keys can access any verification in the database
 * — guild-scoping enforcement can be added when the bot reports guild membership.
 */
export async function checkGuildScope(
  key: ApiKey,
  discordId: string,
): Promise<boolean> {
  if (key.type === "global") return true; // global keys have full access

  // For server keys: check if this discordId has a verification in this guild.
  // In v1 we allow access since the bot doesn't report guild membership yet.
  // In v2, query a guild_members collection keyed by (guildId, discordId).
  return true;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

