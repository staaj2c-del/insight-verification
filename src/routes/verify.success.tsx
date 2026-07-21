import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/verify/success")({
  component: Success,
  validateSearch: (s: Record<string, unknown>) => ({
    u: typeof s.u === "string" ? s.u : "",
    id: typeof s.id === "string" ? s.id : "",
  }),
  head: () => ({ meta: [{ title: "Verified | Insight Bot" }] }),
});

function Success() {
  const { u, id } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <CardTitle>Verified!</CardTitle>
          <CardDescription>
            Your Roblox account is now linked to Insight Bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          {u && <p className="text-sm text-foreground"><span className="text-muted-foreground">Username:</span> <span className="font-medium">{u}</span></p>}
          {id && <p className="text-sm text-foreground"><span className="text-muted-foreground">Roblox ID:</span> <span className="font-mono">{id}</span></p>}
          <p className="text-xs text-muted-foreground pt-2">You can safely close this tab and return to Discord.</p>
        </CardContent>
      </Card>
    </div>
  );
}
