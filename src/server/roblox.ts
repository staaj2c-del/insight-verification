// Roblox OAuth 2.0 helpers (Authorization Code + PKCE optional; we use client secret).
// Docs: https://create.roblox.com/docs/cloud/auth/oauth2-overview

export const ROBLOX_AUTHORIZE_URL = "https://apis.roblox.com/oauth/v1/authorize";
export const ROBLOX_TOKEN_URL = "https://apis.roblox.com/oauth/v1/token";
export const ROBLOX_USERINFO_URL = "https://apis.roblox.com/oauth/v1/userinfo";

export interface RobloxTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface RobloxUserInfo {
  sub: string; // roblox user id
  name?: string;
  nickname?: string; // username
  preferred_username?: string;
  profile?: string;
  picture?: string;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(ROBLOX_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.scope ?? "openid profile");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<RobloxTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const basic = btoa(`${params.clientId}:${params.clientSecret}`);
  const res = await fetch(ROBLOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Roblox token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<RobloxTokenResponse>;
}

export async function fetchUserInfo(accessToken: string): Promise<RobloxUserInfo> {
  const res = await fetch(ROBLOX_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Roblox userinfo failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<RobloxUserInfo>;
}
