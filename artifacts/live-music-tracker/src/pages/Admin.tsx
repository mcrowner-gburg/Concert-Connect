import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListVenues,
  useCreateVenue,
  useScrapeVenue,
  useScrapeAllVenues,
  getListVenuesQueryKey,
  getListShowsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ShieldAlert, Plus, Globe, RefreshCw, Zap, MapPin, Hash,
  CheckCircle2, Loader2, Users, Trash2, ShieldCheck, Shield,
  Crown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  showsCount: number;
  friendsCount: number;
}

interface SyncResult {
  eventsFound: number;
  showsAdded: number;
  showsSkipped: number;
  venuesCreated: number;
}

async function syncTicketmaster(city: string, postalCode: string): Promise<SyncResult> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/ticketmaster/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ city: city.trim() || undefined, postalCode: postalCode.trim() || undefined }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Sync failed");
  return res.json();
}

function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });
}

type Tab = "venues" | "users";

export function Admin() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("venues");

  // Venues state
  const { data: venues, isLoading: loadingVenues } = useListVenues();
  const { mutate: createVenue, isPending: creating } = useCreateVenue();
  const { mutate: scrapeVenue, isPending: scrapingOne } = useScrapeVenue();
  const { mutate: scrapeAll, isPending: scrapingAll } = useScrapeAllVenues();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', city: '', websiteUrl: '', scrapeUrl: '' });
  const [tmCity, setTmCity] = useState('');
  const [tmZip, setTmZip] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Users state
  const { data: users, isLoading: loadingUsers } = useAdminUsers();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: runSync, isPending: syncing } = useMutation({
    mutationFn: () => syncTicketmaster(tmCity, tmZip),
    onSuccess: (result) => {
      setLastSyncResult(result);
      queryClient.invalidateQueries({ queryKey: getListShowsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListVenuesQueryKey() });
      toast({ title: "Sync Complete", description: `Found ${result.eventsFound} events · Added ${result.showsAdded} new shows` });
    },
    onError: (err: Error) => toast({ title: "Sync Failed", description: err.message, variant: "destructive" }),
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setConfirmDelete(null);
      toast({ title: "User deleted" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createVenue({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVenuesQueryKey() });
        setShowForm(false);
        setFormData({ name: '', city: '', websiteUrl: '', scrapeUrl: '' });
        toast({ title: "Venue Added" });
      },
      onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to add venue." }),
    });
  };

  const inputClass = "w-full bg-background border border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl py-2.5 px-4 text-foreground placeholder:text-muted-foreground outline-none text-sm font-medium transition-all";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-destructive/10 border border-destructive rounded-2xl flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h1 className="text-5xl font-display tracking-wide text-foreground mb-1">Admin <span className="text-destructive">Panel</span></h1>
          <p className="text-muted-foreground font-medium">Manage users, venues, and live data imports.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border/50 rounded-xl p-1 w-fit">
        {([["venues", "Venues"], ["users", "Users"]] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === tab ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ─────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display text-white">All Users</h2>
            <span className="text-sm text-muted-foreground">{users?.length ?? 0} accounts</span>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                    <th className="p-4">User</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4">Shows</th>
                    <th className="p-4">Friends</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-sm font-medium">
                  {loadingUsers ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                  ) : users?.map(user => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {user.profileImageUrl
                              ? <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                              : <span className="text-xs font-bold text-muted-foreground">{(user.username ?? user.email ?? "?")[0].toUpperCase()}</span>
                            }
                          </div>
                          <div>
                            <div className="font-bold text-foreground">
                              {user.firstName || user.lastName
                                ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                                : <span className="text-muted-foreground italic">No name</span>
                              }
                            </div>
                            {user.username && <div className="text-xs text-muted-foreground">@{user.username}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-foreground/80">{user.email ?? "—"}</td>
                      <td className="p-4 text-muted-foreground">{format(parseISO(user.createdAt), "MMM d, yyyy")}</td>
                      <td className="p-4 text-foreground">{user.showsCount}</td>
                      <td className="p-4 text-foreground">{user.friendsCount}</td>
                      <td className="p-4">
                        {user.isSuperAdmin
                          ? <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-xs font-bold"><Crown className="w-3 h-3" /> Super Admin</span>
                          : user.isAdmin
                            ? <span className="inline-flex items-center gap-1 bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-xs font-bold"><ShieldCheck className="w-3 h-3" /> Admin</span>
                            : <span className="text-muted-foreground text-xs">User</span>
                        }
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          {currentUser?.isSuperAdmin && !user.isSuperAdmin && (
                            <button
                              onClick={() => toggleAdmin.mutate({ id: user.id, isAdmin: !user.isAdmin })}
                              disabled={toggleAdmin.isPending}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-lg flex items-center gap-1.5 transition-colors text-xs font-bold border border-white/10"
                              title={user.isAdmin ? "Remove admin" : "Make admin"}
                            >
                              {user.isAdmin ? <Shield className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                              {user.isAdmin ? "Remove Admin" : "Make Admin"}
                            </button>
                          )}

                          {currentUser?.isSuperAdmin && !user.isSuperAdmin && (
                            confirmDelete === user.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => deleteUser.mutate(user.id)}
                                  disabled={deleteUser.isPending}
                                  className="px-3 py-1.5 bg-destructive text-white rounded-lg text-xs font-bold hover:bg-destructive/90 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-3 py-1.5 bg-white/5 text-muted-foreground rounded-lg text-xs font-bold hover:bg-white/10 transition-colors border border-white/10"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(user.id)}
                                className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-lg flex items-center gap-1 transition-colors text-xs font-bold"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VENUES TAB ───────────────────────────────── */}
      {activeTab === "venues" && (
        <div className="space-y-8">
          {/* Ticketmaster Sync */}
          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50 bg-gradient-to-r from-[#026CDF]/10 to-transparent">
              <div className="w-10 h-10 bg-[#026CDF]/20 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#026CDF]" />
              </div>
              <div>
                <h2 className="text-xl font-display text-white">Ticketmaster Import</h2>
                <p className="text-sm text-muted-foreground">Pull real upcoming music events by city or zip code.</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    <MapPin className="w-3.5 h-3.5" /> City
                  </label>
                  <input type="text" placeholder="e.g. Nashville" value={tmCity} onChange={e => setTmCity(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    <Hash className="w-3.5 h-3.5" /> Zip Code
                  </label>
                  <input type="text" placeholder="e.g. 37203" value={tmZip} onChange={e => setTmZip(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => runSync()}
                  disabled={syncing || (!tmCity.trim() && !tmZip.trim())}
                  className="flex items-center gap-2 bg-[#026CDF] hover:bg-[#026CDF]/90 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {syncing ? "Syncing..." : "Sync Events"}
                </button>
                <p className="text-xs text-muted-foreground">Up to 200 upcoming music events will be imported.</p>
              </div>
              {lastSyncResult && (
                <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex flex-wrap gap-6">
                  {[
                    { label: "Events found", val: lastSyncResult.eventsFound, color: "text-green-400" },
                    { label: "Shows added", val: lastSyncResult.showsAdded, color: "text-green-400" },
                    { label: "Skipped", val: lastSyncResult.showsSkipped, color: "text-muted-foreground" },
                    { label: "New venues", val: lastSyncResult.venuesCreated, color: "text-blue-400" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 ${color}`} />
                      <span className="text-muted-foreground">{label}:</span>
                      <span className="font-bold text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Venues table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-display text-white">Tracked Venues</h2>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(!showForm)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-2 transition-colors border border-white/10 text-sm">
                  <Plus className="w-4 h-4" /> Add Venue
                </button>
                <button onClick={() => scrapeAll(undefined, { onSuccess: (res) => toast({ title: "Scrape Complete", description: `Added ${res.totalShowsAdded} shows` }) })} disabled={scrapingAll} className="px-5 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-bold flex items-center gap-2 transition-colors text-sm disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${scrapingAll ? 'animate-spin' : ''}`} />
                  {scrapingAll ? 'Scraping...' : 'Scrape All'}
                </button>
              </div>
            </div>

            {showForm && (
              <div className="bg-card border border-border/50 rounded-2xl p-6 mb-6 shadow-lg">
                <h3 className="text-xl font-display mb-5">Add New Venue</h3>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Venue Name *</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">City *</label>
                    <input required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Website URL *</label>
                    <input required type="url" value={formData.websiteUrl} onChange={e => setFormData({...formData, websiteUrl: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Scrape URL (optional)</label>
                    <input type="url" value={formData.scrapeUrl} onChange={e => setFormData({...formData, scrapeUrl: e.target.value})} className={inputClass} />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                    <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">Cancel</button>
                    <button type="submit" disabled={creating} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2">
                      {creating && <Loader2 className="w-4 h-4 animate-spin" />} Save Venue
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                      <th className="p-4">Venue</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Website</th>
                      <th className="p-4">Last Scraped</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-sm font-medium">
                    {loadingVenues ? (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                    ) : venues?.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No venues tracked yet.</td></tr>
                    ) : venues?.map(venue => (
                      <tr key={venue.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-bold text-foreground">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${venue.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            {venue.name}
                          </div>
                        </td>
                        <td className="p-4 text-foreground/80">{venue.city}{venue.state ? `, ${venue.state}` : ''}</td>
                        <td className="p-4">
                          <a href={venue.websiteUrl} target="_blank" rel="noreferrer" className="text-secondary hover:underline flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Link
                          </a>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {venue.lastScrapedAt ? new Date(venue.lastScrapedAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => scrapeVenue({ id: venue.id }, { onSuccess: (res) => toast({ title: "Scrape Complete", description: `Added ${res.showsAdded} shows` }) })}
                              disabled={scrapingOne}
                              className="px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg flex items-center gap-1 transition-colors text-xs font-bold"
                            >
                              <RefreshCw className="w-3 h-3" /> Scrape
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
