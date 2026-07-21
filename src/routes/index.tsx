import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (s: Record<string, unknown>) => ({
    discord_id: typeof s.discord_id === "string" ? s.discord_id : "",
  }),
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
  const search = Route.useSearch();
  const [discordId, setDiscordId] = useState(search.discord_id);
  const [error, setError] = useState("");

  const start = () => {
    const id = discordId.trim();
    if (!/^\d{5,25}$/.test(id)) {
      setError("Enter a valid Discord user ID (17–20 digits).");
      return;
    }
    window.location.href = `/api/auth/roblox/start?discord_id=${encodeURIComponent(id)}`;
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
          <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            insightbot.online
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Roblox Verification</CardTitle>
            <CardDescription>
              Sign in with Roblox to link your account to Insight Bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!search.discord_id && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Discord User ID</label>
                <Input
                  placeholder="e.g. 123456789012345678"
                  value={discordId}
                  onChange={(e) => { setDiscordId(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && start()}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  In Discord: User Settings → Advanced → Developer Mode, then right-click your name → Copy User ID. Normally Insight Bot links you here automatically.
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}

            {search.discord_id && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground text-center">
                Linking Discord ID <span className="font-mono text-foreground">{search.discord_id}</span>
              </div>
            )}

            <Button className="w-full" onClick={start}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/></svg>
              Continue with Roblox
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll be redirected to Roblox to authorize Insight Bot. We only store your Roblox ID, username, and verification time.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border py-4">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Insight Bot — <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">insightbot.online</a>
        </p>
      </footer>
    </div>
  );
}
