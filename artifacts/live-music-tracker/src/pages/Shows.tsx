import { useState, useMemo } from "react";
import { useListShows } from "@workspace/api-client-react";
import { ShowCard } from "@/components/ShowCard";
import { AddShowModal } from "@/components/AddShowModal";
import { Filter, Search, Loader2, Plus, MapPin, Hash, X, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RADIUS_OPTIONS = [
  { label: "10 mi", value: 10 },
  { label: "25 mi", value: 25 },
  { label: "50 mi", value: 50 },
  { label: "100 mi", value: 100 },
];

export function Shows() {
  // Search inputs (what's typed)
  const [cityInput, setCityInput] = useState("");
  const [zipInput, setZipInput] = useState("");
  const [radius, setRadius] = useState(25);

  // Committed search params (only update when Search is clicked)
  const [activeCity, setActiveCity] = useState("");
  const [activeZip, setActiveZip] = useState("");
  const [activeRadius, setActiveRadius] = useState(25);

  // Client-side filters
  const [venueFilter, setVenueFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);

  const { data: shows, isLoading, error } = useListShows({
    city: activeCity || undefined,
    zipCode: activeZip || undefined,
    radius: activeZip ? activeRadius : undefined,
  });

  // Build unique sorted venue list from loaded shows
  const venues = useMemo(() => {
    if (!shows) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of shows) {
      const name = s.venue.name;
      if (!seen.has(name)) { seen.add(name); list.push(name); }
    }
    return list.sort();
  }, [shows]);

  const filteredShows = useMemo(() => {
    if (!shows) return [];
    let result = shows;
    if (venueFilter) result = result.filter(s => s.venue.name === venueFilter);
    if (bandFilter.trim()) {
      const q = bandFilter.trim().toLowerCase();
      result = result.filter(s =>
        (s.artist ?? s.title).toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q)
      );
    }
    return result;
  }, [shows, venueFilter, bandFilter]);

  const handleSearch = () => {
    setActiveCity(cityInput.trim());
    setActiveZip(zipInput.trim());
    setActiveRadius(radius);
    setVenueFilter("");
    setBandFilter("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearSearch = () => {
    setCityInput("");
    setZipInput("");
    setActiveCity("");
    setActiveZip("");
    setVenueFilter("");
    setBandFilter("");
  };

  const hasActiveSearch = activeCity || activeZip;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      <AddShowModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">Upcoming <span className="text-secondary">Shows</span></h1>
          <p className="text-muted-foreground font-medium">Tracking the noise in your area based on your preferences.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors shadow-[0_0_20px_rgba(255,0,127,0.3)] hover:shadow-[0_0_30px_rgba(255,0,127,0.5)] shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:block">Add Show</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* City */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5 flex-1">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="City (e.g. Los Angeles)"
              value={cityInput}
              onChange={e => { setCityInput(e.target.value); if (e.target.value) setZipInput(""); }}
              onKeyDown={handleKeyDown}
              className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-full text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold self-center shrink-0">OR</div>

          {/* Zip */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5 flex-1">
            <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Zip code"
              value={zipInput}
              onChange={e => { setZipInput(e.target.value); if (e.target.value) setCityInput(""); }}
              onKeyDown={handleKeyDown}
              className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-full text-sm font-medium"
            />
          </div>

          <button
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shrink-0"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>

        {/* Band search */}
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5">
          <Music className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Filter by band / artist..."
            value={bandFilter}
            onChange={e => setBandFilter(e.target.value)}
            className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-full text-sm font-medium"
          />
          {bandFilter && (
            <button onClick={() => setBandFilter("")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Radius (only shown when zip is entered) */}
        {zipInput && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Search radius:</span>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    radius === opt.value
                      ? "bg-secondary text-white"
                      : "bg-background border border-border text-muted-foreground hover:border-secondary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active search + venue filter row */}
        {(hasActiveSearch || bandFilter) && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
            {hasActiveSearch && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Location:</span>
                <span className="text-foreground font-semibold">
                  {activeCity || `${activeZip} (+${activeRadius} mi)`}
                </span>
                <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {bandFilter && (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-0.5 text-xs font-bold">
                <Music className="w-3 h-3" />
                {bandFilter}
                <button onClick={() => setBandFilter("")} className="hover:text-white transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {venues.length > 1 && (
              <div className="flex items-center gap-2 ml-auto">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={venueFilter}
                  onChange={e => setVenueFilter(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-1 text-xs text-foreground outline-none focus:border-secondary cursor-pointer"
                >
                  <option value="">All venues ({filteredShows.length})</option>
                  {venues.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-display tracking-widest text-xl">Scouting the venues...</p>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive rounded-2xl p-8 text-center">
          <h3 className="text-destructive font-bold text-xl mb-2">Error loading shows</h3>
          <p className="text-muted-foreground">Please try refreshing the page.</p>
        </div>
      ) : filteredShows.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-lg">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Filter className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-3xl font-display text-foreground mb-3">No Shows Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {hasActiveSearch
              ? "No shows found for that location. Try a wider radius or different city."
              : "Enter a city or zip code above to find shows, or update your location preferences in your profile."}
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
        >
          <AnimatePresence>
            {filteredShows.map(show => (
              <ShowCard key={show.id} show={show} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
