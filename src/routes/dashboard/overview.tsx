import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboard, canManageGuild, type LoaderKey } from "../dashboard";

export const Route = createFileRoute("/dashboard/overview")({
  component: Overview,
  head: () => ({
    meta: [{ title: "Overview | Insight Bot Dashboard" }],
  }),
});

function Overview() {
  const { session, guilds, keys } = useDashboard();
  const managedGuilds = guilds.filter((g) => canManageGuild(g.permissions));
  const authorizedKeys = keys.filter((k: LoaderKey) => k.authorized);
  const pendingKeys = keys.filter((k: LoaderKey) => !k.authorized);

  const stats = [
    { label: "Managed Servers", value: managedGuilds.length, href: null },
    { label: "Active API Keys", value: authorizedKeys.length, href: "/dashboard/keys" },
    { label: "Pending Keys", value: pendingKeys.length, href: "/dashboard/keys" },
  ];

  return (
    <div className="space-y-6">
      {/* User profile card */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-4 p-5">
          {session.discordAvatar ? (
            <img src={session.discordAvatar} alt="" className="h-14 w-14 rounded-full ring-2 ring-border" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
              {session.discordUsername.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{session.discordUsername}</h1>
            <p className="text-xs text-muted-foreground font-mono">{session.discordId}</p>
          </div>
          <a href="/api/auth/discord/logout">
            <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              Logout
            </button>
          </a>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => {
          const content = (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/30 transition-colors">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          );
          if (stat.href) {
            return (
              <Link key={stat.label} to={stat.href} className="block">
                {content}
              </Link>
            );
          }
          return <div key={stat.label}>{content}</div>;
        })}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/keys"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Create API Key
          </Link>
          <a
            href="/api/docs"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            API Documentation
          </a>
        </div>
      </div>

      {/* Managed servers list */}
      {managedGuilds.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Your Servers</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {managedGuilds.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm">
                {g.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=40`}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {g.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{g.id}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {g.owner ? "Owner" : "Admin"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

