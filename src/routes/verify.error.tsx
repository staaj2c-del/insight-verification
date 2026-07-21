import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify/error")({
  component: ErrorPage,
  validateSearch: (s: Record<string, unknown>) => ({
    reason: typeof s.reason === "string" ? s.reason : "unknown",
  }),
  head: () => ({ meta: [{ title: "Verification failed | Insight Bot" }] }),
});

const REASONS: Record<string, string> = {
  missing_params: "Roblox didn't return a valid response.",
  state_mismatch: "Security check failed. Please start over.",
  bad_state: "Invalid verification state.",
  server_config: "The server is not configured correctly.",
  oauth_failed: "We couldn't verify your Roblox account. Please try again.",
  access_denied: "You cancelled the Roblox authorization.",
};

function ErrorPage() {
  const { reason } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>{REASONS[reason] ?? "Something went wrong."}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-xs text-muted-foreground font-mono">reason: {reason}</p>
          <Button asChild variant="outline"><a href="/">Start over</a></Button>
        </CardContent>
      </Card>
    </div>
  );
}
