import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDashboard, canManageGuild, type LoaderKey } from "../dashboard";

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
  const [creating, setCreating] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const managedGuilds = guilds.filter((g) => canManageGuild(g.permissions));

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
    <div className="space-y-6">
      {/* Create API Key Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Create API Key</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Generate keys for your bot to call the Insight Bot API on behalf of a server.
          </p>
        </div>
        <div className="p-5 space-y-5">
          {/* Server Key */}
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
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Key label (e.g. MyBot Production)"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
            />
            <button
              onClick={() => createKey("server")}
              disabled={creating || !selectedGuild}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Server Key"}
            </button>
          </div>

          <hr className="border-border" />

          {/* Global Key */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Global Key{" "}
              <span className="text-xs font-normal text-amber-500">(requires staff approval)</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Cross-server access. After creation, Insight Bot staff will review and authorize your key via Discord.
            </p>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Key label (e.g. Public Bot API)"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
            />
            <button
              onClick={() => createKey("global")}
              disabled={creating}
              className="w-full rounded-md border border-border bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {creating ? "Requesting…" : "Request Global Key"}
            </button>
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
        </div>
      </div>

      {/* Your API Keys Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Your API Keys</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Active keys for your account. Revoked keys are not shown.
          </p>
        </div>
        <div className="p-5">
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
                  <button
                    onClick={() => doRevoke(k.fullKey)}
                    disabled={loading === k.fullKey}
                    className="rounded-md px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0 ml-2"
                  >
                    {loading === k.fullKey ? "…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

