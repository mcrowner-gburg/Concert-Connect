import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ShowCard } from "@/components/ShowCard";
import { getListShowsQueryKey, getGetFriendsActivityQueryKey, type ShowWithDetails } from "@workspace/api-client-react";
import { Loader2, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function useMyShows() {
  return useQuery<ShowWithDetails[]>({
    queryKey: ["/api/shows/attending"],
    queryFn: async () => {
      const res = await fetch("/api/shows/attending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load your shows");
      return res.json();
    },
  });
}

export function MyShows() {
  const { data: shows, isLoading, error } = useMyShows();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">
          My <span className="text-primary">Shows</span>
        </h1>
        <p className="text-muted-foreground font-medium">Shows you've marked as going, and who else is coming.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-display tracking-widest text-xl">Loading your shows...</p>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive rounded-2xl p-8 text-center">
          <h3 className="text-destructive font-bold text-xl mb-2">Error loading shows</h3>
          <p className="text-muted-foreground">Please try refreshing the page.</p>
        </div>
      ) : !shows?.length ? (
        <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-lg">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Ticket className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-3xl font-display text-foreground mb-3">No upcoming shows</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Head to <a href="/shows" className="text-primary hover:underline">Shows</a> and mark some events as going.
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
        >
          <AnimatePresence>
            {shows.map(show => (
              <ShowCard key={show.id} show={show} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
