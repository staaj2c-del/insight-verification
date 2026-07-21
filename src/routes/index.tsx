import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { getVerifySession } from "@/lib/verify-fns";
import { getSiteStats } from "@/lib/staff-fns";

function getSessionIdFromCookie(request: Request | undefined): string | null {
  if (!request) return null;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("ibs="));
  if (!match) return null;
  return decodeURIComponent(match.slice("ibs=".length));
}

export const Route = createFileRoute("/")({
  loader: async ({ request }) => {
    const sessionId = getSessionIdFromCookie(request);
    let session: { discordId: string; discordUsername: string; discordAvatar: string | null } | null = null;
    if (sessionId) {
      const s = await getVerifySession({ data: { sessionId } });
      if (s) session = s;
    }
    if (!session && request) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? request.headers.get("x-real-ip")
        ?? null;
      if (ip) {
        const { getIpSession } = await import("@/lib/verify-fns");
        const ipSession = await getIpSession({ data: { ip } });
        if (ipSession) session = ipSession;
      }
    }
    // Fetch public stats (non-blocking)
    let stats = { verifications: 0, apiKeys: 0, tokens: 0 };
    try { stats = await getSiteStats(); } catch { /* non-critical */ }
    return { session, stats };
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Insight Bot — Roblox Verification" },
      { name: "description", content: "Link your Roblox account to Discord via Insight Bot. Fast, secure Roblox OAuth verification for communities." },
      { property: "og:title", content: "Insight Bot — Roblox Verification" },
      { property: "og:description", content: "Link your Roblox account to Discord via Insight Bot. Trusted by communities worldwide." },
    ],
  }),
});

function Index() {
  const data = Route.useLoaderData() as {
    session: { discordId: string; discordUsername: string; discordAvatar: string | null } | null;
    stats: { verifications: number; apiKeys: number; tokens: number };
  };
  const search = Route.useSearch();
  const [error, setError] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const discordId = search.discord_id || data.session?.discordId || "";

  useEffect(() => {
    const token = search.token?.trim();
    if (!token) return;
    setVerifyingToken(true);
    fetch(`/api/public/token/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((resData) => {
        if (resData.discord_id) {
          window.location.href = `/api/auth/roblox/start?discord_id=${encodeURIComponent(resData.discord_id)}&token=${encodeURIComponent(token)}`;
        } else {
          setError(resData.error || "Invalid or expired verification link.");
          setVerifyingToken(false);
        }
      })
      .catch(() => {
        setError("Unable to validate your verification link. Please try again.");
        setVerifyingToken(false);
      });
  }, [search.token]);

  const startVerification = () => {
    const token = search.token?.trim();
    const params = new URLSearchParams({ discord_id: discordId });
    if (token) params.set("token", token);
    window.location.href = `/api/auth/roblox/start?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <span className="font-semibold text-foreground">Insight Bot</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link to="/dashboard" className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Dashboard
            </Link>
            <a href="/api/docs" className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              API Docs
            </a>
            <a href="/dashboard/staff" className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden sm:inline-flex items-center gap-1">
              Staff
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">STAFF</Badge>
            </a>
            <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden sm:inline">
              Website
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 py-16 sm:py-24">
            <div className="flex flex-col lg:flex-row items-center gap-10">
              {/* Left: Hero text + CTA */}
              <div className="flex-1 text-center lg:text-left space-y-6">
                <Badge variant="secondary" className="text-xs">
                  Now with Developer API
                </Badge>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
                  Roblox Verification{" "}
                  <span className="text-primary">Made Simple</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Link Roblox accounts to Discord in seconds. Official Roblox OAuth, persistent sessions, and a powerful API for developers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  {verifyingToken ? (
                    <Button disabled size="lg">
                      <span className="animate-spin mr-2">⟳</span> Verifying…
                    </Button>
                  ) : discordId ? (
                    <Button size="lg" onClick={startVerification} className="gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/></svg>
                      Continue with Roblox
                    </Button>
                  ) : (
                    <a href="/api/auth/discord/start?redirect_to=/">
                      <Button size="lg" className="gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>
                        Sign in with Discord
                      </Button>
                    </a>
                  )}
                  <a href="/dashboard">
                    <Button variant="outline" size="lg" className="gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/></svg>
                      Developer Dashboard
                    </Button>
                  </a>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {data.session && (
                  <div className="flex items-center gap-2 justify-center lg:justify-start text-sm text-muted-foreground">
                    {data.session.discordAvatar && (
                      <img src={data.session.discordAvatar} alt="" className="h-6 w-6 rounded-full" />
                    )}
                    Signed in as <span className="font-medium text-foreground">{data.session.discordUsername}</span>
                  </div>
                )}
              </div>

              {/* Right: Stats card */}
              <div className="flex-1 w-full max-w-md lg:max-w-none">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                      Platform Stats
                    </CardTitle>
                    <CardDescription>Real-time usage across Insight Bot</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-primary">{data.stats.verifications.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Verifications</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-primary">{data.stats.apiKeys.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">API Keys</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-primary">{data.stats.tokens.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Tokens Used</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature Cards ── */}
        <section className="border-t border-border bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center mb-10 space-y-2">
              <Badge variant="outline">Features</Badge>
              <h2 className="text-3xl font-bold text-foreground">Everything You Need</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Insight Bot provides a complete verification platform for Discord communities.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10m-3-7 2 2 4-4"
                title="Secure OAuth"
                desc="Official Roblox OAuth2 flow. We never see your Roblox password — just your public profile ID and username."
              />
              <FeatureCard
                icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                title="Developer API"
                desc="REST API for bot developers. Create server or global keys, check verifications, and auto-verify users in your server."
              />
              <FeatureCard
                icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m12-6a4 4 0 10-8 0m10 6a4 4 0 01-4 4m-6-4a4 4 0 014-4"
                title="Staff Tools"
                desc="Built-in staff panel for managing API key approvals, user lookups, and moderation — all from the dashboard."
              />
              <FeatureCard
                icon="M13 10V3L4 14h7v7l9-11h-7z"
                title="Fast & Reliable"
                desc="Deployed on Vercel's global edge network. Sub-100ms API responses. MongoDB-backed for durability."
              />
              <FeatureCard
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Auto-Verification"
                desc="Bots can create one-time tokens. Users click a link, verify with Roblox, and the bot gets notified instantly."
              />
              <FeatureCard
                icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                title="Persistent Sessions"
                desc="IP-based session persistence. Come back later and you're still logged in. No re-auth required for 7 days."
              />
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-6">
            <h2 className="text-3xl font-bold text-foreground">Ready to Get Started?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Join thousands of Discord servers using Insight Bot for Roblox verification.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/api/auth/discord/start?redirect_to=/">
                <Button size="lg" className="gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>
                  Get Verified
                </Button>
              </a>
              <a href="/dashboard">
                <Button variant="outline" size="lg" className="gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/></svg>
                  Developer Dashboard
                </Button>
              </a>
              <a href="/api/docs">
                <Button variant="outline" size="lg" className="gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  API Documentation
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
              </div>
              <span className="text-sm font-medium text-foreground">Insight Bot</span>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
              <a href="/api/docs" className="hover:text-foreground transition-colors">API Docs</a>
              <a href="/dashboard/staff" className="hover:text-foreground transition-colors">Staff</a>
              <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Website</a>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} Insight Bot. Not affiliated with Roblox Corporation.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors">
      <CardHeader>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d={icon}/></svg>
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

