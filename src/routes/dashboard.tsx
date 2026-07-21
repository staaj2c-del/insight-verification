import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import { resolveDashboardSession, getDashboardGuilds, getDashboardKeys } from "@/lib/dashboard-fns";

// ── Pure helper (no server deps) ───────────────────────────────────
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
export function canManageGuild(permissions: string): boolean {
  const perms = BigInt(permissions);
  return (perms & MANAGE_GUILD) !== 0n || (perms & ADMINISTRATOR) !== 0n;
}

// ── Types for loader data ──
export interface LoaderSession {
  sessionId: string;
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  accessToken: string;
}
export interface LoaderGuild { id: string; name: string; icon: string | null; owner: boolean; permissions: string; features: string[] }
export interface LoaderKey {
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

export const DashboardContext = createContext<{
  session: LoaderSession;
  guilds: LoaderGuild[];
  keys: LoaderKey[];
} | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within a dashboard route");
  return ctx;
}

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    // resolveDashboardSession uses getWebRequest() internally (server-only),
    // so it correctly reads the ibs cookie on every SSR request.
    const session = await resolveDashboardSession();
    if (!session) {
      return { session: null, guilds: [], keys: [] };
    }
    const [guilds, keys] = await Promise.all([
      getDashboardGuilds({ data: { sessionId: session.sessionId } }),
      getDashboardKeys({ data: { sessionId: session.sessionId } }),
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

  // Sidebar nav items
  const navItems = [
    { to: "/dashboard/overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
    { to: "/dashboard/keys", label: "API Keys", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
    { to: "/api/docs", label: "API Docs", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ];

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md shadow-lg rounded-xl border border-border bg-card p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Developer Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Log in with Discord to create API keys for your bot.
            </p>
            <a href="/api/auth/discord/start" className="block w-full">
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                </svg>
                Login with Discord
              </button>
            </a>
            <p className="text-xs text-muted-foreground">
              We request <code className="bg-muted px-1 rounded text-[11px]">identify</code> and <code className="bg-muted px-1 rounded text-[11px]">guilds</code> scopes to verify your identity and list your servers.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{ session, guilds, keys }}>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          <div className="flex gap-6">
            {/* Sidebar */}
            <aside className="w-56 shrink-0 hidden md:block">
              <nav className="sticky top-20 space-y-1">
                {navItems.map((item) => {
                  const isExternal = item.to.startsWith("/api/");
                  if (isExternal) {
                    return (
                      <a
                        key={item.to}
                        href={item.to}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                        {item.label}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeProps={{ className: "bg-muted text-foreground font-medium" }}
                      inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-muted" }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            {/* Mobile nav (top pills) */}
            <div className="md:hidden w-full mb-4 flex gap-1 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const isExternal = item.to.startsWith("/api/");
                if (isExternal) {
                  return (
                    <a key={item.to} href={item.to} className="shrink-0 rounded-full px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                      {item.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeProps={{ className: "bg-primary/10 text-primary border-primary/30 font-medium" }}
                    inactiveProps={{ className: "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30" }}
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs border transition-colors"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Page content */}
            <div className="flex-1 min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </DashboardContext.Provider>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
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


