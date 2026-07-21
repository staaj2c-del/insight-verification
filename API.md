# Insight Bot Verification — API Reference

Build your own bot using Insight Bot's Roblox verification database. This API lets you generate verification links, query a user's verification status, and unverify users programmatically.

---

## Architecture

```
┌──────────┐     POST /api/public/tokens      ┌───────────────┐
│ Your Bot │ ─────────────────────────────────►│ Insight Verify│
│          │◄──── { token, verify_url } ──────│   (Vercel)    │
│          │                                   │               │
│          │  DM verify_url to Discord user ──►│  ┌─────────┐  │
│          │                                   │  │ MongoDB  │  │
│          │  GET /api/public/verification/:id │  │  (Atlas) │  │
│          │◄──── { verified, robloxId, … } ──│  └─────────┘  │
└──────────┘                                   └───────────────┘
```

---

## Authentication

The API uses two separate secrets — keep them distinct:

| Env Variable | Used By | Purpose |
|---|---|---|
| `API_SECRET` | `POST /api/public/tokens` | Your bot sends this in the JSON body to prove it's authorized to generate verification links. |
| `BOT_API_KEY` | `GET/DELETE /api/public/verification/:id` | Sent as a `Bearer` token in the `Authorization` header to read or delete verification records. |

**Never expose these in client-side code.** They belong in your bot's environment variables only.

---

## Endpoints

### 1. Create Verification Token

Generate a one-time-use token that lets a Discord user verify their Roblox account without typing their Discord ID.

```
POST https://verify.insightbot.online/api/public/tokens
Content-Type: application/json
```

**Request Body**

```json
{
  "discord_id": "123456789012345678",
  "secret": "your-api-secret-here"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `discord_id` | string | Yes | Discord user ID (5–25 digits) |
| `secret` | string | Yes | Must match the `API_SECRET` env var set in Vercel |

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
| 401 | `{ "error": "Unauthorized" }` | `secret` doesn't match `API_SECRET` |
| 500 | `{ "error": "Internal error" }` | Database failure |

**Usage:** DM the `verify_url` to the user. When they click it, the page auto-resolves the token, pre-fills their Discord ID, and redirects them straight to Roblox OAuth. No manual typing needed.

---

### 2. Look Up Verification

Check whether a Discord user has a verified Roblox account on file.

```
GET https://verify.insightbot.online/api/public/verification/{discordId}
Authorization: Bearer your-bot-api-key
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
| 401 | `{ "error": "unauthorized" }` | Missing or wrong `BOT_API_KEY` |
| 500 | `{ "error": "server_not_configured" }` | `BOT_API_KEY` env var not set |

**Usage:** Call this when a user runs your bot's `/verify` or `/whois` command. If `verified: true`, you know their Roblox ID and username. Use `discordId` from the response (not the request) to confirm you're looking at the right record.

---

### 3. Delete / Unverify

Remove a user's verification record, e.g. when they leave your server or request a re-verify.

```
DELETE https://verify.insightbot.online/api/public/verification/{discordId}
Authorization: Bearer your-bot-api-key
```

**Response `200 OK`**

```json
{
  "deleted": 1
}
```

`deleted` is the count of documents removed (0 if none matched, 1 if a record was deleted).

**Errors:** Same as the GET endpoint above.

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

## Verification Flow (Step by Step)

### Token-Based Auto-Flow (Recommended)

1. User runs your bot's `/verify` command in Discord.
2. Your bot calls `POST /api/public/tokens` with the user's Discord ID and your `API_SECRET`.
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

## Discord OAuth (Bot Dashboard)

> **Coming soon.** A management dashboard at `https://verify.insightbot.online/dashboard` where server admins log in via Discord OAuth to view verification stats, manage users, and configure settings.

| Setting | Value |
|---|---|
| **Discord OAuth Link** | *(pending — will be provided)* |
| **Client ID** | *(pending)* |
| **Redirect URI / Callback URL** | `https://verify.insightbot.online/api/auth/discord/callback` |

---

## Callback URLs (All)

| Service | Callback URL |
|---|---|
| **Roblox OAuth** | `https://verify.insightbot.online/api/auth/roblox/callback` |
| **Discord OAuth** (planned) | `https://verify.insightbot.online/api/auth/discord/callback` |

---

## Environment Variables Reference

These must be set in your Vercel project dashboard under **Settings → Environment Variables**.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `MONGODB_DB` | No | Database name (defaults to connection string's default) |
| `ROBLOX_CLIENT_ID` | Yes | Roblox OAuth App client ID |
| `ROBLOX_CLIENT_SECRET` | Yes | Roblox OAuth App client secret |
| `API_SECRET` | Yes (bot) | Shared secret your bot sends to create tokens |
| `BOT_API_KEY` | Yes (bot) | Bearer token for verification lookup/delete endpoints |

---

## Quickstart (Discord.js Bot)

```js
// Your bot's verify command
const VERIFY_API = 'https://verify.insightbot.online/api/public';

async function handleVerify(interaction) {
  const discordId = interaction.user.id;

  // Step 1: Create a verification token
  const tokenRes = await fetch(`${VERIFY_API}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      discord_id: discordId,
      secret: process.env.API_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    return interaction.reply({ content: `❌ ${err.error}`, ephemeral: true });
  }

  const { verify_url: verifyUrl } = await tokenRes.json();

  // Step 2: DM the link to the user
  try {
    await interaction.user.send(
      `🔗 **Verify your Roblox account:**\n${verifyUrl}\n\nThis link is single-use and expires after use.`
    );
    await interaction.reply({ content: '📬 Check your DMs!', ephemeral: true });
  } catch {
    await interaction.reply({ content: '❌ I couldn\'t DM you. Please open your DMs and try again.', ephemeral: true });
  }
}

// Your bot's check command
async function handleWhois(interaction) {
  const targetId = interaction.options.getUser('user')?.id ?? interaction.user.id;

  const res = await fetch(`${VERIFY_API}/verification/${targetId}`, {
    headers: { Authorization: `Bearer ${process.env.BOT_API_KEY}` },
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

## Rate Limits & Fair Use

- Tokens are **one-time use**. Once consumed during a successful verification, they cannot be reused.
- Unused tokens remain valid indefinitely (until used).
- No hard rate limits are enforced, but abuse will result in your `API_SECRET` or `BOT_API_KEY` being rotated.

---

*Last updated: 2026-07-21*
*Maintained by Insight Bot — [insightbot.online](https://insightbot.online)*

