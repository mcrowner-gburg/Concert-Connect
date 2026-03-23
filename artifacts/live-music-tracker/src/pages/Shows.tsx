import { useState } from "react";
import { useListShows } from "@workspace/api-client-react";
import { ShowCard } from "@/components/ShowCard";
import { AddShowModal } from "@/components/AddShowModal";
import { Filter, Search, Loader2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Shows() {
  const [cityFilter, setCityFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  
  const { data: shows, isLoading, error } = useListShows({
    city: cityFilter || undefined
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      
      <AddShowModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">Upcoming <span className="text-secondary">Shows</span></h1>
          <p className="text-muted-foreground font-medium">Tracking the noise in your area based on your preferences.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3 bg-card border border-border/50 rounded-xl p-2 flex-1 md:max-w-sm shadow-lg">
            <Search className="w-5 h-5 text-muted-foreground ml-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Filter by city..." 
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground w-full py-1 px-2 font-medium"
            />
            <button className="bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors border border-white/5 shrink-0">
              <Filter className="w-4 h-4 text-foreground" />
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors shadow-[0_0_20px_rgba(255,0,127,0.3)] hover:shadow-[0_0_30px_rgba(255,0,127,0.5)] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Add Show</span>
          </button>
        </div>
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
      ) : shows?.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-lg">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Filter className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-3xl font-display text-foreground mb-3">No Shows Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't find any shows matching your current filters. Try changing your city or updating your preferences in your profile.
          </p>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
        >
          <AnimatePresence>
            {shows?.map(show => (
              <ShowCard key={show.id} show={show} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
