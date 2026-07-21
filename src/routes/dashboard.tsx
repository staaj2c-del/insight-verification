import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { getDashboardSession, getDashboardGuilds, getDashboardKeys } from "@/lib/dashboard-fns";

// ── Pure helper (no server deps) ───────────────────────────────────
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
function canManageGuild(permissions: string): boolean {
  const perms = BigInt(permissions);
  return (perms & MANAGE_GUILD) !== 0n || (perms & ADMINISTRATOR) !== 0n;
}

// ── Types for loader data ──
interface LoaderSession {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  accessToken: string;
}
interface LoaderGuild { id: string; name: string; icon: string | null; owner: boolean; permissions: string; features: string[] }
interface LoaderKey {
  key: string;
  fullKey: string;
  type: string;
  guildId: string | null;
  guildName: string | null;
  label: string;
  authorized: boolean;
  createdAt: string;
  lastUsed: string | null;
}

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    const session = await getDashboardSession();
    if (!session) {
      return { session: null, guilds: [], keys: [] };
    }
    const [guilds, keys] = await Promise.all([
      getDashboardGuilds(),
      getDashboardKeys(),
    ]);
    return { session, guilds: guilds ?? [], keys: keys ?? [] } as {
      session: LoaderSession;
      guilds: LoaderGuild[];
      keys: LoaderKey[];
    };
  },
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Developer Dashboard | Insight Bot" },
      { name: "description", content: "Manage your Insight Bot API keys and verification settings." },
    ],
  }),
});

function Dashboard() {
  const data = Route.useLoaderData() as {
    session: LoaderSession | null;
    guilds: LoaderGuild[];
    keys: LoaderKey[];
  };
  const { session, guilds, keys } = data;
  const [keysState, setKeysState] = useState(keys);
  const [loading, setLoading] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const managedGuilds = guilds.filter((g) => canManageGuild(g.permissions));

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <CardTitle>Developer Dashboard</CardTitle>
              <CardDescription>
                Log in with Discord to create API keys for your bot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a href="/api/auth/discord/start" className="block w-full">
                <Button className="w-full" variant="default">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor" className="mr-2">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                  Login with Discord
                </Button>
              </a>
              <p className="text-xs text-center text-muted-foreground">
                We request <code>identify</code> and <code>guilds</code> scopes to verify your identity and list your servers.
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const createKey = async (type: "server" | "global") => {
    if (type === "server" && !selectedGuild) return;
    setCreating(true);
    setCopySuccess(null);
    try {
      const guild = managedGuilds.find((g) => g.id === selectedGuild);
      const body: Record<string, unknown> = {
        type,
        label: newKeyLabel || `Key for ${guild?.name ?? "bot"}`,
      };
      if (type === "server" && guild) {
        body.guildId = guild.id;
        body.guildName = guild.name;
      }
      const res = await fetch("/api/public/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resData = await res.json();
      if (resData.key) {
        await navigator.clipboard.writeText(resData.key);
        setCopySuccess(resData.key);
        const keysRes = await fetch("/api/public/keys");
        const keysData = await keysRes.json();
        setKeysState(keysData.keys ?? []);
        setNewKeyLabel("");
      } else {
        alert(resData.error ?? "Failed to create key");
      }
    } catch {
      alert("Network error creating key");
    } finally {
      setCreating(false);
    }
  };

  const doRevoke = async (fullKey: string) => {
    if (!confirm("Revoke this key? This cannot be undone.")) return;
    setLoading(fullKey);
    try {
      await fetch("/api/public/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fullKey }),
      });
      setKeysState((prev) => prev.filter((k) => k.fullKey !== fullKey));
    } catch {
      alert("Failed to revoke key");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 py-4">
            {session.discordAvatar && (
              <img src={session.discordAvatar} alt="" className="h-12 w-12 rounded-full" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-foreground">{session.discordUsername}</p>
              <p className="text-xs text-muted-foreground font-mono">{session.discordId}</p>
            </div>
            <a href="/api/auth/discord/logout">
              <Button variant="outline" size="sm">Logout</Button>
            </a>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Create API Key</CardTitle>
            <CardDescription>
              Generate keys for your bot to call the Insight Bot API on behalf of a server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Server Key</h3>
              <p className="text-xs text-muted-foreground">
                Scoped to one Discord server. Auto-approved. Use for verification commands in your bot.
              </p>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedGuild}
                onChange={(e) => setSelectedGuild(e.target.value)}
              >
                <option value="">Select a server…</option>
                {managedGuilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.id})
                  </option>
                ))}
              </select>
              <Input
                placeholder="Key label (e.g. MyBot Production)"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
              />
              <Button
                onClick={() => createKey("server")}
                disabled={creating || !selectedGuild}
                className="w-full"
              >
                {creating ? "Creating…" : "Create Server Key"}
              </Button>
            </div>

            <hr className="border-border" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Global Key{" "}
                <span className="text-xs font-normal text-amber-500">(requires staff approval)</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Cross-server access. After creation, Insight Bot staff will review and authorize your key via Discord.
              </p>
              <Input
                placeholder="Key label (e.g. Public Bot API)"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
              />
              <Button
                onClick={() => createKey("global")}
                disabled={creating}
                variant="secondary"
                className="w-full"
              >
                {creating ? "Requesting…" : "Request Global Key"}
              </Button>
            </div>

            {copySuccess && (
              <div className="rounded-md bg-success/10 border border-success/30 p-3 text-sm">
                <p className="font-semibold text-success">Key created & copied to clipboard!</p>
                <p className="text-xs text-muted-foreground mt-1 break-all font-mono">{copySuccess}</p>
                <p className="text-xs text-amber-400 mt-2">
                  ⚠️ Save this key now — you won't see it again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Your API Keys</CardTitle>
            <CardDescription>
              Active keys for your account. Revoked keys are not shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keysState.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No keys yet. Create one above.
              </p>
            ) : (
              <div className="space-y-3">
                {keysState.map((k) => (
                  <div key={k.fullKey} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{k.key}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                          k.type === "global" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {k.type}
                        </span>
                        {!k.authorized && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400">
                            PENDING
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground">{k.label}</p>
                      {k.guildName && <p className="text-[11px] text-muted-foreground">{k.guildName}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => doRevoke(k.fullKey)}
                      disabled={loading === k.fullKey}
                    >
                      {loading === k.fullKey ? "…" : "Revoke"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span className="font-semibold text-foreground">Insight Bot</span>
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Developer Dashboard</span>
        </div>
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Verify
        </a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-4">
      <p className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Insight Bot —{" "}
        <a href="https://insightbot.online" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          insightbot.online
        </a>
      </p>
    </footer>
  );
}


