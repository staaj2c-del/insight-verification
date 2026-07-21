import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  getStaffContext,
  getPendingGlobalKeys,
  approveGlobalKey,
  getAllVerifications,
  getBlacklists,
  blacklistDiscordId,
  blacklistIp,
  removeBlacklist,
  lookupUserIps,
  getStaffMembers,
  addStaffMember,
  removeStaffMember,
} from "@/lib/staff-fns";
import type { IpLookupResult, StaffMember } from "@/lib/staff-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserX, ShieldBan, Globe, Search, Check, X, Trash2, Shield, User, MapPin, Crown, UserPlus } from "lucide-react";

export const Route = createFileRoute("/dashboard/staff")({
  loader: async () => {
    try {
      const staff = await getStaffContext();
      if (!staff) throw redirect({ to: "/dashboard/overview" });
      const [pendingKeys, verifications, blacklists] = await Promise.all([
        getPendingGlobalKeys(),
        getAllVerifications({ data: { page: 1, limit: 20 } }),
        getBlacklists(),
      ]);
      return { error: null, staff, pendingKeys: pendingKeys ?? [], verifications, blacklists: blacklists ?? [] };
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as Record<string, unknown>)) throw e;
      return { error: e instanceof Error ? e.message : "Failed to load staff data", staff: null, pendingKeys: [], verifications: { docs: [], total: 0 }, blacklists: [] };
    }
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
    error: string | null;
    staff: {
      discordId: string;
      discordUsername: string;
      discordAvatar: string | null;
      robloxUsername: string | null;
      robloxId: string | null;
      robloxDisplayName: string | null;
      isOwner: boolean;
    } | null;
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
    blacklists: Array<{
      type: "discordId" | "ip";
      value: string;
      reason: string;
      addedBy: string;
      addedAt: string;
    }>;
  };

  if (data.error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">Staff Panel Error</p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">{data.error}</p>
        <p className="text-xs text-muted-foreground mt-3">
          Make sure <code className="bg-muted px-1 rounded">STAFF_DISCORD_IDS</code> is set in your Vercel environment variables.
        </p>
      </div>
    );
  }
  if (!data.staff) {
    return (
      <div className="rounded-xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">You do not have staff access.</p>
      </div>
    );
  }

  const isOwnerUser = data.staff.isOwner;

  const [approving, setApproving] = useState<string | null>(null);
  const [pendingKeysState, setPendingKeysState] = useState(data.pendingKeys);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(data.verifications.docs);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("keys");

  // Blacklist state
  const [blacklistsState, setBlacklistsState] = useState(data.blacklists);
  const [blDiscordId, setBlDiscordId] = useState("");
  const [blReason, setBlReason] = useState("");
  const [blIp, setBlIp] = useState("");
  const [blIpReason, setBlIpReason] = useState("");
  const [blacklisting, setBlacklisting] = useState(false);

  // IP Lookup state (owner only)
  const [ipQuery, setIpQuery] = useState("");
  const [ipResults, setIpResults] = useState<IpLookupResult[]>([]);
  const [ipLooking, setIpLooking] = useState(false);

  // Staff management state (owner only)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffMembersLoaded, setStaffMembersLoaded] = useState(false);
  const [newStaffId, setNewStaffId] = useState("");
  const [addingStaff, setAddingStaff] = useState(false);
  const [removingStaff, setRemovingStaff] = useState<string | null>(null);

  const loadStaffMembers = async () => {
    if (!staffMembersLoaded) {
      try {
        const members = await getStaffMembers();
        setStaffMembers(members ?? []);
      } catch { /* silently fail */ }
      setStaffMembersLoaded(true);
    }
  };

  const handleApprove = async (key: string) => {
    setApproving(key);
    try {
      await approveGlobalKey({ data: { key } });
      setPendingKeysState((prev) => prev.filter((k) => k.key !== key));
      toast.success("Global key approved!");
    } catch {
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

  const handleIpLookup = async () => {
    if (!ipQuery.trim()) return;
    setIpLooking(true);
    setIpResults([]);
    try {
      const res = await lookupUserIps({ data: { query: ipQuery.trim() } });
      setIpResults(res ?? []);
      if ((res ?? []).length === 0) toast.info("No IP records found for that user.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "IP lookup failed");
    } finally {
      setIpLooking(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffId.trim()) return;
    setAddingStaff(true);
    try {
      await addStaffMember({ data: { discordId: newStaffId.trim() } });
      toast.success(`Added ${newStaffId.trim()} as staff.`);
      setNewStaffId("");
      setStaffMembersLoaded(false);
      loadStaffMembers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add staff.");
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (discordId: string) => {
    setRemovingStaff(discordId);
    try {
      await removeStaffMember({ data: { discordId } });
      toast.success(`Removed ${discordId} from staff.`);
      setStaffMembers((prev) => prev.filter((m) => m.discordId !== discordId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove staff.");
    } finally {
      setRemovingStaff(null);
    }
  };

  const handleBlacklistDiscordId = async () => {
    if (!blDiscordId.trim() || !blReason.trim()) return;
    setBlacklisting(true);
    try {
      await blacklistDiscordId({ data: { discordId: blDiscordId.trim(), reason: blReason.trim() } });
      toast.success(`Blacklisted Discord ID ${blDiscordId.trim()}`);
      setBlDiscordId("");
      setBlReason("");
      const updated = await getBlacklists();
      setBlacklistsState(updated ?? []);
    } catch {
      toast.error("Failed to blacklist.");
    } finally {
      setBlacklisting(false);
    }
  };

  const handleBlacklistIp = async () => {
    if (!blIp.trim() || !blIpReason.trim()) return;
    setBlacklisting(true);
    try {
      await blacklistIp({ data: { ip: blIp.trim(), reason: blIpReason.trim() } });
      toast.success(`Blacklisted IP ${blIp.trim()}`);
      setBlIp("");
      setBlIpReason("");
      const updated = await getBlacklists();
      setBlacklistsState(updated ?? []);
    } catch {
      toast.error("Failed to blacklist.");
    } finally {
      setBlacklisting(false);
    }
  };

  const handleRemoveBlacklist = async (type: string, value: string) => {
    try {
      await removeBlacklist({ data: { type, value } });
      toast.success(`Removed ${value} from blacklist.`);
      setBlacklistsState((prev) => prev.filter((b) => !(b.type === type && b.value === value)));
    } catch {
      toast.error("Failed to remove.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Staff Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Panel</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {data.staff.discordUsername}.
          </p>
        </div>
        <Badge variant={isOwnerUser ? "default" : "destructive"} className="gap-1">
          {isOwnerUser ? (
            <><Crown className="h-3 w-3" /> Owner</>
          ) : (
            <><Shield className="h-3 w-3" /> Staff</>
          )}
        </Badge>
      </div>

      {/* Staff Profile Card — shows Roblox info */}
      <Card className="bg-muted/20">
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          {data.staff.discordAvatar && (
            <img src={data.staff.discordAvatar} alt="" className="h-12 w-12 rounded-full" />
          )}
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">{data.staff.discordUsername}</p>
            <p className="text-xs text-muted-foreground font-mono">{data.staff.discordId}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {data.staff.robloxUsername ? (
              <div className="text-right">
                <p className="text-sm font-medium text-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {data.staff.robloxDisplayName ?? data.staff.robloxUsername}
                  {data.staff.robloxDisplayName && data.staff.robloxDisplayName !== data.staff.robloxUsername && (
                    <span className="text-xs text-muted-foreground">(@{data.staff.robloxUsername})</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-mono">Roblox ID: {data.staff.robloxId}</p>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                No Roblox linked
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="keys">
            Pending Keys
            {pendingKeysState.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {pendingKeysState.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
          {isOwnerUser && <TabsTrigger value="iplookup">IP Lookup</TabsTrigger>}
          {isOwnerUser && <TabsTrigger value="staffmgmt">Staff Mgmt</TabsTrigger>}
          <TabsTrigger value="blacklist">
            Blacklist
            {blacklistsState.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {blacklistsState.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Pending Keys Tab ── */}
        <TabsContent value="keys" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Pending Global Key Requests
              </CardTitle>
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
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(k.key)}
                              disabled={approving === k.key}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              {approving === k.key ? "Approving..." : "Approve"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Verifications Tab ── */}
        <TabsContent value="verifications" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Verification Lookup
              </CardTitle>
              <CardDescription>
                Search verified users by Discord ID, Roblox ID, or Roblox username.
              </CardDescription>
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
                      <TableHead>Roblox User</TableHead>
                      <TableHead>Roblox ID</TableHead>
                      <TableHead>Verified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((v: Record<string, unknown>) => (
                      <TableRow key={v.discordId as string}>
                        <TableCell className="font-mono text-xs">{v.discordId as string}</TableCell>
                        <TableCell className="text-sm">
                          <p>{v.robloxDisplayName as string || v.robloxUsername as string}</p>
                          {v.robloxDisplayName && v.robloxDisplayName !== v.robloxUsername && (
                            <p className="text-xs text-muted-foreground">@{v.robloxUsername as string}</p>
                          )}
                        </TableCell>
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

        {/* ── Owner-only: IP Lookup Tab ── */}
        {isOwnerUser && (
          <TabsContent value="iplookup" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-amber-500" />
                  IP Address Lookup
                </CardTitle>
                <CardDescription>
                  Look up IP addresses by Discord ID, Roblox ID, or Roblox username.
                  <span className="block text-amber-500 font-medium mt-1">Owner-only feature.</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Discord ID (e.g. 123456789012345678) or Roblox ID/username..."
                    value={ipQuery}
                    onChange={(e) => setIpQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIpLookup()}
                  />
                  <Button onClick={handleIpLookup} disabled={ipLooking || !ipQuery.trim()}>
                    {ipLooking ? "Looking up..." : "Lookup IP"}
                  </Button>
                </div>

                {ipResults.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Discord</TableHead>
                        <TableHead>Roblox</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Sessions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ipResults.map((r, i) => (
                        <TableRow key={`${r.discordId}-${r.ip}-${i}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.discordAvatar && (
                                <img src={r.discordAvatar} alt="" className="h-6 w-6 rounded-full" />
                              )}
                              <div>
                                <p className="text-sm font-medium">{r.discordUsername}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{r.discordId}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.robloxUsername ? (
                              <div>
                                <p>{r.robloxDisplayName ?? r.robloxUsername}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{r.robloxId}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-amber-500 font-semibold">{r.ip}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.lastSeen).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.sessionCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {ipResults.length === 0 && !ipLooking && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Search for a user above to view their IP addresses.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Owner-only: Staff Management Tab ── */}
        {isOwnerUser && (
          <TabsContent value="staffmgmt" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Staff Management
                </CardTitle>
                <CardDescription>
                  Add or remove staff members. Staff can approve keys, manage blacklists, and search verifications.
                  <span className="block text-amber-500 font-medium mt-1">Owner-only feature.</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Discord User ID to add as staff..."
                    value={newStaffId}
                    onChange={(e) => setNewStaffId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddStaff()}
                  />
                  <Button onClick={handleAddStaff} disabled={addingStaff || !newStaffId.trim()}>
                    {addingStaff ? "Adding..." : "Add Staff"}
                  </Button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-foreground">Current Staff Members</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={loadStaffMembers}
                    >
                      Refresh
                    </Button>
                  </div>
                  {staffMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff members added yet. Use the form above or set <code className="bg-muted px-1 rounded text-xs">STAFF_DISCORD_IDS</code> in Vercel.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Discord ID</TableHead>
                          <TableHead>Added By</TableHead>
                          <TableHead>Added At</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffMembers.map((m) => (
                          <TableRow key={m.discordId}>
                            <TableCell className="font-mono text-xs">{m.discordId}</TableCell>
                            <TableCell className="text-sm">{m.addedBy}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(m.addedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveStaff(m.discordId)}
                                disabled={removingStaff === m.discordId}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {removingStaff === m.discordId ? "Removing..." : "Remove"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Blacklist Tab ── */}
        <TabsContent value="blacklist" className="space-y-4 pt-4">
          {/* Blacklist Discord ID */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserX className="h-5 w-5 text-destructive" />
                Blacklist Discord User
              </CardTitle>
              <CardDescription>
                Prevent a Discord user from verifying or using the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Discord User ID (e.g. 123456789012345678)"
                  value={blDiscordId}
                  onChange={(e) => setBlDiscordId(e.target.value)}
                />
                <Input
                  placeholder="Reason"
                  value={blReason}
                  onChange={(e) => setBlReason(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button
                  variant="destructive"
                  onClick={handleBlacklistDiscordId}
                  disabled={blacklisting || !blDiscordId.trim() || !blReason.trim()}
                >
                  <ShieldBan className="h-4 w-4 mr-1" />
                  {blacklisting ? "..." : "Blacklist"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Blacklist IP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-destructive" />
                Blacklist IP Address
              </CardTitle>
              <CardDescription>
                Block all access from a specific IP address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="IP Address (e.g. 192.168.1.1)"
                  value={blIp}
                  onChange={(e) => setBlIp(e.target.value)}
                />
                <Input
                  placeholder="Reason"
                  value={blIpReason}
                  onChange={(e) => setBlIpReason(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button
                  variant="destructive"
                  onClick={handleBlacklistIp}
                  disabled={blacklisting || !blIp.trim() || !blIpReason.trim()}
                >
                  <ShieldBan className="h-4 w-4 mr-1" />
                  {blacklisting ? "..." : "Blacklist"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Blacklist List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldBan className="h-5 w-5" />
                Active Blacklists ({blacklistsState.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blacklistsState.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No blacklisted users or IPs.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blacklistsState.map((b) => (
                      <TableRow key={`${b.type}-${b.value}`}>
                        <TableCell>
                          <Badge variant={b.type === "discordId" ? "default" : "secondary"} className="text-[10px] uppercase">
                            {b.type === "discordId" ? "User ID" : "IP"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{b.value}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{b.reason}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.addedBy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(b.addedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveBlacklist(b.type, b.value)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
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
      </Tabs>
    </div>
  );
}

