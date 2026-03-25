import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useListVenues, 
  useCreateVenue, 
  useScrapeVenue, 
  useScrapeAllVenues,
  getListVenuesQueryKey,
  getListShowsQueryKey,
} from "@workspace/api-client-react";
import { ShieldAlert, Plus, Globe, RefreshCw, Zap, MapPin, Hash, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    body: JSON.stringify({
      city: city.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Sync failed");
  }
  return res.json();
}

export function Admin() {
  const { data: venues, isLoading } = useListVenues();
  const { mutate: createVenue, isPending: creating } = useCreateVenue();
  const { mutate: scrapeVenue, isPending: scrapingOne } = useScrapeVenue();
  const { mutate: scrapeAll, isPending: scrapingAll } = useScrapeAllVenues();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', city: '', websiteUrl: '', scrapeUrl: '' });

  const [tmCity, setTmCity] = useState('');
  const [tmZip, setTmZip] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const { mutate: runSync, isPending: syncing } = useMutation({
    mutationFn: () => syncTicketmaster(tmCity, tmZip),
    onSuccess: (result) => {
      setLastSyncResult(result);
      queryClient.invalidateQueries({ queryKey: getListShowsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListVenuesQueryKey() });
      toast({
        title: "Ticketmaster Sync Complete",
        description: `Found ${result.eventsFound} events · Added ${result.showsAdded} new shows · Created ${result.venuesCreated} venues`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createVenue(
      { data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVenuesQueryKey() });
          setShowForm(false);
          setFormData({ name: '', city: '', websiteUrl: '', scrapeUrl: '' });
          toast({ title: "Venue Added", description: "Successfully added new venue." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to add venue." });
        }
      }
    );
  };

  const handleScrapeOne = (id: number) => {
    scrapeVenue({ id }, {
      onSuccess: (res) => {
        toast({ title: "Scrape Complete", description: `Found ${res.showsFound} shows. Added ${res.showsAdded} new ones.` });
      }
    });
  };

  const handleScrapeAll = () => {
    scrapeAll(undefined, {
      onSuccess: (res) => {
        toast({ title: "Global Scrape Complete", description: `Scraped ${res.venuesScraped} venues. Added ${res.totalShowsAdded} total shows.` });
      }
    });
  };

  const inputClass = "w-full bg-background border border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl py-2.5 px-4 text-foreground placeholder:text-muted-foreground outline-none text-sm font-medium transition-all";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-destructive/10 border border-destructive rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-5xl font-display tracking-wide text-foreground mb-1">Admin <span className="text-destructive">Panel</span></h1>
            <p className="text-muted-foreground font-medium">Manage venues, scraping, and live data imports.</p>
          </div>
        </div>
      </div>

      {/* ── Ticketmaster Sync ─────────────────────────────── */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50 bg-gradient-to-r from-[#026CDF]/10 to-transparent">
          <div className="w-10 h-10 bg-[#026CDF]/20 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#026CDF]" />
          </div>
          <div>
            <h2 className="text-xl font-display text-white">Ticketmaster Import</h2>
            <p className="text-sm text-muted-foreground">Pull real upcoming music events by city or zip code directly into the app.</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                <MapPin className="w-3.5 h-3.5" /> City
              </label>
              <input
                type="text"
                placeholder="e.g. Nashville"
                value={tmCity}
                onChange={e => setTmCity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Hash className="w-3.5 h-3.5" /> Zip Code
              </label>
              <input
                type="text"
                placeholder="e.g. 37203"
                value={tmZip}
                onChange={e => setTmZip(e.target.value)}
                className={inputClass}
              />
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
            <p className="text-xs text-muted-foreground">Enter a city, zip code, or both. Up to 200 upcoming music events will be imported.</p>
          </div>

          {lastSyncResult && (
            <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex flex-wrap gap-6">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-muted-foreground">Events found:</span>
                <span className="font-bold text-foreground">{lastSyncResult.eventsFound}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-muted-foreground">Shows added:</span>
                <span className="font-bold text-foreground">{lastSyncResult.showsAdded}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Skipped (already exist):</span>
                <span className="font-bold text-foreground">{lastSyncResult.showsSkipped}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span className="text-muted-foreground">New venues created:</span>
                <span className="font-bold text-foreground">{lastSyncResult.venuesCreated}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Venues ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display text-white">Tracked Venues</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-2 transition-colors border border-white/10 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Venue
            </button>
            <button
              onClick={handleScrapeAll}
              disabled={scrapingAll}
              className="px-5 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-bold flex items-center gap-2 transition-colors text-sm disabled:opacity-50"
            >
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
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading venues...</td></tr>
                ) : venues?.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No venues tracked yet.</td></tr>
                ) : (
                  venues?.map(venue => (
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
                            onClick={() => handleScrapeOne(venue.id)}
                            disabled={scrapingOne}
                            className="px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg flex items-center gap-1 transition-colors text-xs font-bold"
                          >
                            <RefreshCw className="w-3 h-3" /> Scrape
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
