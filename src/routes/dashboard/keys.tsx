import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDashboard, canManageGuild, type LoaderKey } from "../dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Copy, Key, Server, Globe, Trash2, Clock, AlertCircle, Shield } from "lucide-react";

export const Route = createFileRoute("/dashboard/keys")({
  component: Keys,
  head: () => ({
    meta: [{ title: "API Keys | Insight Bot Dashboard" }],
  }),
});

function Keys() {
  const { guilds, keys } = useDashboard();
  const [keysState, setKeysState] = useState(keys);
  const [loading, setLoading] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [creating, setCreating] = useState<"server" | "global" | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const managedGuilds = guilds.filter((g) => canManageGuild(g.permissions));

  const createKey = async (type: "server" | "global") => {
    if (type === "server" && !selectedGuild) return;
    setCreating(type);
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
        toast.success(`${type === "server" ? "Server" : "Global"} key created & copied!`);
        const keysRes = await fetch("/api/public/keys");
        const keysData = await keysRes.json();
        setKeysState(keysData.keys ?? []);
        setNewKeyLabel("");
      } else {
        toast.error(resData.error ?? "Failed to create key");
      }
    } catch {
      toast.error("Network error creating key");
    } finally {
      setCreating(null);
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
      toast.success("Key revoked.");
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate keys for bots to call the Insight Bot API. Server keys are scoped per-guild and auto-approved.
        </p>
      </div>

      {/* Create Keys Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Create New Key
          </CardTitle>
          <CardDescription>Keys authenticate your bot's API requests. Treat them like passwords.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Label Input */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Key Label</label>
            <Input
              placeholder="e.g. Production Bot, Staging, My Verifier..."
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
            />
          </div>

          {/* Server Key Section */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-foreground">Server Key</h3>
              <Badge variant="secondary" className="text-[10px]">Auto-Approved</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Scoped to a single Discord server. Use for in-server verification commands.
            </p>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedGuild}
              onChange={(e) => setSelectedGuild(e.target.value)}
            >
              <option value="">Select a server you manage…</option>
              {managedGuilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.id})
                </option>
              ))}
            </select>
            {managedGuilds.length === 0 && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No managed servers found. You need &quot;Manage Server&quot; permission in a Discord server.
              </p>
            )}
            <Button
              onClick={() => createKey("server")}
              disabled={creating !== null || !selectedGuild}
              className="w-full"
              variant="default"
            >
              {creating === "server" ? (
                <span className="animate-spin mr-2">⟳</span>
              ) : (
                <Server className="h-4 w-4 mr-2" />
              )}
              {creating === "server" ? "Creating…" : "Create Server Key"}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Global Key Section */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-foreground">Global Key</h3>
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">Staff Review</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Cross-server access. Insight Bot staff will review and authorize your request. Usually within 24 hours.
            </p>
            <Button
              onClick={() => createKey("global")}
              disabled={creating !== null}
              className="w-full"
              variant="outline"
            >
              {creating === "global" ? (
                <span className="animate-spin mr-2">⟳</span>
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              {creating === "global" ? "Requesting…" : "Request Global Key"}
            </Button>
          </div>

          {/* Success banner */}
          {copySuccess && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">Key Created & Copied!</p>
              </div>
              <code className="block text-xs text-emerald-300 break-all font-mono bg-emerald-500/5 rounded px-2 py-1">
                {copySuccess}
              </code>
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Save this key now — it won&apos;t be shown again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your Keys Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your API Keys
          </CardTitle>
          <CardDescription>
            {keysState.length} active key{keysState.length !== 1 ? "s" : ""}. Revoked keys are hidden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keysState.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Key className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
              <p className="text-xs text-muted-foreground">Create one above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keysState.map((k) => (
                <div
                  key={k.fullKey}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border p-4 text-sm hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {k.key}
                      </code>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] uppercase ${
                          k.type === "global"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {k.type === "global" ? <Globe className="h-3 w-3 mr-0.5 inline" /> : <Server className="h-3 w-3 mr-0.5 inline" />}
                        {k.type}
                      </Badge>
                      {!k.authorized && (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                          <Clock className="h-3 w-3 mr-0.5 inline" /> Pending Approval
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-foreground">{k.label}</p>
                    {k.guildName && (
                      <p className="text-xs text-muted-foreground">Server: {k.guildName}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsed && ` · Used ${new Date(k.lastUsed).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(k.fullKey)}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => doRevoke(k.fullKey)}
                      disabled={loading === k.fullKey}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {loading === k.fullKey ? "…" : "Revoke"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

