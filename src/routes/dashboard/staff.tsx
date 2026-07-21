import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  getStaffContext,
  getPendingGlobalKeys,
  approveGlobalKey,
  getAllVerifications,
} from "@/lib/staff-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/dashboard/staff")({
  loader: async () => {
    const staff = await getStaffContext();
    if (!staff) throw redirect({ to: "/dashboard/overview" });
    const [pendingKeys, verifications] = await Promise.all([
      getPendingGlobalKeys(),
      getAllVerifications({ data: { page: 1, limit: 20 } }),
    ]);
    return { staff, pendingKeys: pendingKeys ?? [], verifications };
  },
  component: StaffPanel,
  head: () => ({
    meta: [
      { title: "Staff Panel | Insight Bot" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function StaffPanel() {
  const data = Route.useLoaderData() as {
    staff: { discordId: string; discordUsername: string; discordAvatar: string | null };
    pendingKeys: Array<{
      key: string;
      ownerId: string;
      ownerName: string;
      label: string;
      createdAt: string;
      guildId: string | null;
      guildName: string | null;
    }>;
    verifications: { docs: Array<Record<string, unknown>>; total: number };
  };

  const [approving, setApproving] = useState<string | null>(null);
  const [pendingKeysState, setPendingKeysState] = useState(data.pendingKeys);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(data.verifications.docs);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("keys");

  const handleApprove = async (key: string) => {
    setApproving(key);
    try {
      await approveGlobalKey({ data: { key } });
      setPendingKeysState((prev) => prev.filter((k) => k.key !== key));
      toast.success("Global key approved!");
    } catch (e) {
      toast.error("Failed to approve key.");
    } finally {
      setApproving(null);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await getAllVerifications({ data: { page: 1, limit: 50, search: searchQuery } });
      setSearchResults(res.docs);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Panel</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {data.staff.discordUsername}. Manage keys, verifications, and more.
          </p>
        </div>
        <Badge variant="destructive">Staff</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="keys">
            Pending Keys
            {pendingKeysState.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {pendingKeysState.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Global Key Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingKeysState.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No pending key requests.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Guild</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingKeysState.map((k) => (
                      <TableRow key={k.key}>
                        <TableCell>
                          <p className="font-medium text-sm">{k.ownerName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{k.ownerId}</p>
                        </TableCell>
                        <TableCell className="text-sm">{k.label}</TableCell>
                        <TableCell className="text-sm">
                          {k.guildName ?? <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(k.key)}
                            disabled={approving === k.key}
                          >
                            {approving === k.key ? "Approving..." : "Approve"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verifications" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verification Lookup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by Discord ID, Roblox ID, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? "Searching..." : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Discord ID</TableHead>
                      <TableHead>Roblox Username</TableHead>
                      <TableHead>Roblox ID</TableHead>
                      <TableHead>Verified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((v: Record<string, unknown>) => (
                      <TableRow key={v.discordId as string}>
                        <TableCell className="font-mono text-xs">{v.discordId as string}</TableCell>
                        <TableCell className="text-sm">{v.robloxUsername as string}</TableCell>
                        <TableCell className="font-mono text-xs">{v.robloxId as string}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(v.verifiedAt as string).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Search for verified users above.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

