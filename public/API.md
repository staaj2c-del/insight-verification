# Insight Bot Verification — API Reference

Build your own bot using Insight Bot's Roblox verification database. This API lets you generate verification links, query a user's verification status, and unverify users programmatically.

---

## Developer API Keys

All API endpoints (except the verification token resolution) require authentication. You have two options:

### Option 1: Developer API Keys (Recommended)

1. Log into the **[Developer Dashboard](https://verify.insightbot.online/dashboard)** with Discord.
2. Choose a server you manage (requires **Manage Guild** or **Administrator** permission).
3. Click **Create Server Key** — the key is instantly generated and auto-authorized.
4. For cross-server access, click **Request Global Key** — Insight Bot staff will review and approve it via Discord.

**Key format:**
- Server keys: `insight_server_<48 hex chars>`
- Global keys: `insight_global_<48 hex chars>`

Use as a Bearer token:
```bash
Authorization: Bearer insight_server_abc123...
```

### Option 2: Legacy Env Vars

Still supported but deprecated for new bots. See [Legacy Auth](#legacy-auth) at the bottom.

---

## Discord OAuth (Dashboard Login)

| Setting | Value |
|---|---|
| **Discord OAuth Link** | `https://discord.com/oauth2/authorize?client_id=1394833496580689980&response_type=code&redirect_uri=https%3A%2F%2Fverify.insightbot.online%2Fapi%2Fauth%2Fdiscord%2Fcallback&scope=identify+guilds` |
| **Client ID** | `1394833496580689980` |
| **Scopes** | `identify` `guilds` |
| **Redirect URI / Callback** | `https://verify.insightbot.online/api/auth/discord/callback` |
| **Dashboard URL** | `https://verify.insightbot.online/dashboard` |

Make sure the redirect URI above is added in the [Discord Developer Portal](https://discord.com/developers/applications/1394833496580689980/oauth2) → OAuth2 → Redirects.

---

## Architecture

```
┌──────────┐     POST /api/public/tokens      ┌───────────────┐
│ Your Bot │ ─────────────────────────────────►│ Insight Verify│
│          │◄──── { token, verify_url } ──────│   (Vercel)    │
│          │  Authorization: Bearer <key>      │               │
│          │  DM verify_url to Discord user ──►│  ┌─────────┐  │
│          │                                   │  │ MongoDB  │  │
│          │  GET /api/public/verification/:id │  │  (Atlas) │  │
│          │◄──── { verified, robloxId, … } ──│  └─────────┘  │
└──────────┘                                   └───────────────┘
```

---

## Endpoints

### 1. Create Verification Token

Generate a one-time-use token that lets a Discord user verify their Roblox account without typing their Discord ID.

```
POST https://verify.insightbot.online/api/public/tokens
Content-Type: application/json
Authorization: Bearer insight_server_xxx   (recommended)
```

**Request Body**

```json
{
  "discord_id": "123456789012345678"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `discord_id` | string | Yes | Discord user ID (5–25 digits) |

**Response `200 OK`**

```json
{
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "verify_url": "https://verify.insightbot.online/?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Errors**

| Status | Body | Meaning |
|---|---|---|
| 400 | `{ "error": "Valid discord_id required" }` | Missing or malformed discord_id |
| 401 | `{ "error": "Unauthorized…" }` | Invalid or missing API key |
| 500 | `{ "error": "Internal error" }` | Database failure |

**Usage:** DM the `verify_url` to the user. When they click it, the page auto-resolves the token, pre-fills their Discord ID, and redirects them straight to Roblox OAuth. No manual typing needed.

---

### 2. Look Up Verification

Check whether a Discord user has a verified Roblox account on file.

```
GET https://verify.insightbot.online/api/public/verification/{discordId}
Authorization: Bearer insight_server_xxx
```

**Response `200 OK`** (verified)

```json
{
  "verified": true,
  "discordId": "123456789012345678",
  "robloxId": "987654321",
  "robloxUsername": "Builderman",
  "robloxDisplayName": "BuilderMan2024",
  "verifiedAt": "2026-07-15T18:30:00.000Z",
  "updatedAt": "2026-07-15T18:30:00.000Z"
}
```

**Response `404 Not Found`** (unverified or unknown)

```json
{
  "verified": false
}
```

**Errors**

| Status | Body | Meaning |
|---|---|---|
| 401 | `{ "error": "unauthorized" }` | Missing or invalid API key |
| 500 | — | Server error |

**Usage:** Call this when a user runs your bot's `/verify` or `/whois` command. If `verified: true`, you know their Roblox ID and username.

---

### 3. Delete / Unverify

Remove a user's verification record, e.g. when they leave your server or request a re-verify.

```
DELETE https://verify.insightbot.online/api/public/verification/{discordId}
Authorization: Bearer insight_server_xxx
```

**Response `200 OK`**

```json
{
  "deleted": 1
}
```

`deleted` is the count of documents removed (0 if none matched, 1 if a record was deleted).

---

## Token Endpoints (Internal)

These are called by the frontend, not by your bot directly. Listed here for completeness.

### Resolve Token

```
GET https://verify.insightbot.online/api/public/token/{token}
```

**Response `200 OK`** (valid)

```json
{
  "discord_id": "123456789012345678"
}
```

**Response `404`** (invalid/expired)

```json
{
  "error": "Invalid or expired token"
}
```

---

## Developer API Key Management

These endpoints are called by the dashboard. They use session cookies, not Bearer tokens.

### Create Key

```
POST https://verify.insightbot.online/api/public/keys
Cookie: ibs=<session>
Content-Type: application/json

{
  "type": "server",
  "guildId": "1234567890",
  "guildName": "My Server",
  "label": "MyBot Production"
}
```

### List Keys

```
GET https://verify.insightbot.online/api/public/keys
Cookie: ibs=<session>
```

### Revoke Key

```
DELETE https://verify.insightbot.online/api/public/keys
Cookie: ibs=<session>
Content-Type: application/json

{ "key": "insight_server_abc123..." }
```

---

## Verification Flow (Step by Step)

### Token-Based Auto-Flow (Recommended)

1. User runs your bot's `/verify` command in Discord.
2. Your bot calls `POST /api/public/tokens` with the user's Discord ID.
3. Your bot DMs the user the `verify_url` from the response.
4. User clicks the link — the page auto-detects their Discord ID and redirects to Roblox.
5. User authorizes Insight Bot on Roblox.
6. The callback saves the verification to MongoDB.
7. Your bot calls `GET /api/public/verification/{discordId}` to confirm.

### Manual Flow (No Bot)

1. User visits `https://verify.insightbot.online`.
2. User enters their Discord ID and clicks "Continue with Roblox."
3. Same as steps 5–7 above.

---

## Roblox OAuth Scopes

| Scope | Purpose |
|---|---|
| `openid` | Get the user's Roblox ID (`sub` claim) |
| `profile` | Get `preferred_username`, `nickname`, `name`, `picture` |

These are set in the `ROBLOX_CLIENT_ID` app on the Roblox Creator Dashboard under **OAuth 2.0 → Scopes**.

---

## Callback URLs (All)

| Service | Callback URL |
|---|---|
| **Roblox OAuth** | `https://verify.insightbot.online/api/auth/roblox/callback` |
| **Discord OAuth** (Dashboard) | `https://verify.insightbot.online/api/auth/discord/callback` |

---

## Environment Variables Reference

These must be set in your Vercel project dashboard under **Settings → Environment Variables**.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `MONGODB_DB` | No | Database name (defaults to connection string's default) |
| `ROBLOX_CLIENT_ID` | Yes | Roblox OAuth App client ID |
| `ROBLOX_CLIENT_SECRET` | Yes | Roblox OAuth App client secret |
| `DISCORD_CLIENT_ID` | Yes (dashboard) | Discord OAuth App client ID |
| `DISCORD_CLIENT_SECRET` | Yes (dashboard) | Discord OAuth App client secret |
| `API_SECRET` | No (legacy) | Shared secret for token creation (deprecated, use dev keys) |
| `BOT_API_KEY` | No (legacy) | Bearer token for verification lookup (deprecated, use dev keys) |
| `STAFF_DISCORD_IDS` | Yes (staff) | Comma-separated Discord user IDs authorized to approve global keys |

---

## Quickstart (Discord.js Bot with Developer Keys)

```js
const VERIFY_API = 'https://verify.insightbot.online/api/public';
const API_KEY = 'insight_server_your_key_here'; // From dashboard

async function handleVerify(interaction) {
  const discordId = interaction.user.id;

  const tokenRes = await fetch(`${VERIFY_API}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ discord_id: discordId }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    return interaction.reply({ content: `❌ ${err.error}`, ephemeral: true });
  }

  const { verify_url: verifyUrl } = await tokenRes.json();

  try {
    await interaction.user.send(
      `🔗 **Verify your Roblox account:**\n${verifyUrl}\n\nThis link is single-use and expires after use.`
    );
    await interaction.reply({ content: '📬 Check your DMs!', ephemeral: true });
  } catch {
    await interaction.reply({ content: "❌ I couldn't DM you. Please open your DMs and try again.", ephemeral: true });
  }
}

async function handleWhois(interaction) {
  const targetId = interaction.options.getUser('user')?.id ?? interaction.user.id;

  const res = await fetch(`${VERIFY_API}/verification/${targetId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (res.status === 404) {
    return interaction.reply(`<@${targetId}> hasn't verified yet.`);
  }

  const data = await res.json();

  await interaction.reply(
    `✅ **${data.robloxUsername}** (@${data.robloxDisplayName})\n` +
    `Roblox ID: \`${data.robloxId}\`\n` +
    `Verified: <t:${Math.floor(new Date(data.verifiedAt).getTime() / 1000)}:R>`
  );
}
```

---

## Legacy Auth (Deprecated)

If you haven't migrated to developer keys yet, you can still send a `secret` in the JSON body for token creation, or use `BOT_API_KEY` as a Bearer token for lookups. These will be removed in a future update.

---

## Rate Limits & Fair Use

- Tokens are **one-time use**. Once consumed during a successful verification, they cannot be reused.
- Unused tokens remain valid indefinitely (until used).
- No hard rate limits are enforced, but abuse will result in your API key being revoked.

---

*Last updated: 2026-07-21*
*Maintained by Insight Bot — [insightbot.online](https://insightbot.online)*


