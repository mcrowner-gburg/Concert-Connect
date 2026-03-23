import { useState } from "react";
import { 
  useListVenues, 
  useCreateVenue, 
  useScrapeVenue, 
  useScrapeAllVenues,
  getListVenuesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Plus, Globe, RefreshCw, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Admin() {
  const { data: venues, isLoading } = useListVenues();
  const { mutate: createVenue, isPending: creating } = useCreateVenue();
  const { mutate: scrapeVenue, isPending: scrapingOne } = useScrapeVenue();
  const { mutate: scrapeAll, isPending: scrapingAll } = useScrapeAllVenues();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', city: '', websiteUrl: '', scrapeUrl: '' });

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
        onError: (err) => {
          toast({ variant: "destructive", title: "Error", description: "Failed to add venue." });
        }
      }
    );
  };

  const handleScrapeOne = (id: number) => {
    scrapeVenue(
      { id },
      {
        onSuccess: (res) => {
          toast({ 
            title: "Scrape Complete", 
            description: `Found ${res.showsFound} shows. Added ${res.showsAdded} new ones.` 
          });
        }
      }
    );
  };

  const handleScrapeAll = () => {
    scrapeAll(
      undefined,
      {
        onSuccess: (res) => {
          toast({ 
            title: "Global Scrape Complete", 
            description: `Scraped ${res.venuesScraped} venues. Added ${res.totalShowsAdded} total shows.` 
          });
        }
      }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-destructive/10 border border-destructive rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-5xl font-display tracking-wide text-foreground mb-1">Admin <span className="text-destructive">Access</span></h1>
            <p className="text-muted-foreground font-medium">Manage venues and trigger scraping engines.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-2 transition-colors border border-white/10"
          >
            <Plus className="w-5 h-5" /> Add Venue
          </button>
          <button 
            onClick={handleScrapeAll}
            disabled={scrapingAll}
            className="px-6 py-3 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-[0_0_20px_rgba(255,0,0,0.3)] disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${scrapingAll ? 'animate-spin' : ''}`} /> 
            {scrapingAll ? 'Scraping...' : 'Scrape All'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 mb-8 shadow-lg">
          <h3 className="text-2xl font-display mb-6">Add New Venue</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold">Venue Name *</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-border rounded-lg px-4 py-2 outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold">City *</label>
              <input required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-background border border-border rounded-lg px-4 py-2 outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold">Website URL *</label>
              <input required type="url" value={formData.websiteUrl} onChange={e => setFormData({...formData, websiteUrl: e.target.value})} className="w-full bg-background border border-border rounded-lg px-4 py-2 outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold">Scrape URL (optional if same)</label>
              <input type="url" value={formData.scrapeUrl} onChange={e => setFormData({...formData, scrapeUrl: e.target.value})} className="w-full bg-background border border-border rounded-lg px-4 py-2 outline-none focus:border-primary" />
            </div>
            <div className="md:col-span-2 flex justify-end mt-4">
              <button type="submit" disabled={creating} className="px-8 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50">
                Save Venue
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-sm font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
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
                    <td className="p-4 font-bold text-foreground flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${venue.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      {venue.name}
                    </td>
                    <td className="p-4 text-foreground/80">{venue.city}</td>
                    <td className="p-4">
                      <a href={venue.websiteUrl} target="_blank" rel="noreferrer" className="text-secondary hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Link
                      </a>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {venue.lastScrapedAt ? new Date(venue.lastScrapedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-4 flex justify-end gap-2">
                      <button 
                        onClick={() => handleScrapeOne(venue.id)}
                        disabled={scrapingOne}
                        className="px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded flex items-center gap-1 transition-colors"
                        title="Run Scraper"
                      >
                        <RefreshCw className="w-4 h-4" /> Scrape
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
