import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getVerifySession } from "@/lib/verify-fns";

export const Route = createFileRoute("/")({
  loader: async () => {
    const session = await getVerifySession();
    return { session };
  },
  validateSearch: (s: Record<string, unknown>) => ({
    discord_id: typeof s.discord_id === "string" ? s.discord_id : "",
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: Index,
  head: () => ({
    meta: [
      { title: "Verify | Insight Bot" },
      { name: "description", content: "Link your Roblox account to Insight Bot via official Roblox OAuth." },
      { property: "og:title", content: "Verify | Insight Bot" },
      { property: "og:description", content: "Link your Roblox account to Insight Bot via official Roblox OAuth." },
    ],
  }),
});

function Index() {
  const data = Route.useLoaderData() as { session: { discordId: string; discordUsername: string; discordAvatar: string | null } | null };
  const search = Route.useSearch();
  const [error, setError] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);

  // Use the discord_id from search params (callback redirect) or from session
  const discordId = search.discord_id || data.session?.discordId || "";

  // Auto-resolve token: the bot gives users a link like /?token=abc123
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
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <span className="font-semibold text-foreground">Insight Bot</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </a>
            <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              insightbot.online
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {verifyingToken ? (
          <Card className="w-full max-w-md shadow-lg border-border/50">
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Verifying your link…</p>
            </CardContent>
          </Card>
        ) : !discordId ? (
          /* ── Not logged in with Discord — show login prompt ── */
          <Card className="w-full max-w-md shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">Roblox Verification</CardTitle>
              <CardDescription>
                Log in with Discord to link your Roblox account to Insight Bot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a href="/api/auth/discord/start?redirect_to=/" className="block w-full">
                <Button className="w-full" variant="default">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor" className="mr-2">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                  Login with Discord
                </Button>
              </a>
              <p className="text-xs text-center text-muted-foreground">
                We use Discord to confirm your identity before linking your Roblox account. Only your ID and username are stored.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* ── Logged in — show Roblox verification ── */
          <Card className="w-full max-w-md shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">Roblox Verification</CardTitle>
              <CardDescription>
                Sign in with Roblox to link your account to Insight Bot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {data.session && (
                <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  {data.session.discordAvatar && (
                    <img src={data.session.discordAvatar} alt="" className="h-10 w-10 rounded-full" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{data.session.discordUsername}</p>
                    <p className="text-xs text-muted-foreground font-mono">{data.session.discordId}</p>
                  </div>
                  <div className="ml-auto">
                    <a
                      href="/api/auth/discord/logout"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Not you?
                    </a>
                  </div>
                </div>
              )}

              {search.discord_id && !data.session && (
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground text-center">
                  Linking Discord ID <span className="font-mono text-foreground">{search.discord_id}</span>
                </div>
              )}

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button className="w-full" onClick={startVerification}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/></svg>
                Continue with Roblox
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                You'll be redirected to Roblox to authorize Insight Bot. We only store your Roblox ID, username, and verification time.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-border py-4">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Insight Bot — <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">insightbot.online</a>
        </p>
      </footer>
    </div>
  );
}

