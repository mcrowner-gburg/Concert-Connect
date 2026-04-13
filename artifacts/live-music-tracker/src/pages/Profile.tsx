import { useState, useEffect } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetUserPreferences, useUpdateUserPreferences } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Settings, MapPin, Hash, Save, Loader2, User, CheckCircle2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface ShowHistoryItem {
  id: number;
  title: string;
  artist: string | null;
  showDate: string;
  venueName: string;
  venueCity: string;
  ticketUrl: string | null;
  friendsWhoAttended: Array<{ username: string; profileImageUrl: string | null }>;
}

function useShowHistory() {
  return useQuery<ShowHistoryItem[]>({
    queryKey: ["/api/shows/history"],
    queryFn: async () => {
      const res = await fetch("/api/shows/history", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });
}

export function Profile() {
  const { user } = useAuth();
  const { data: prefs, isLoading: loadingPrefs } = useGetUserPreferences();
  const { mutate: updatePrefs, isPending: savingPrefs } = useUpdateUserPreferences();
  const { data: history, isLoading: loadingHistory } = useShowHistory();
  const { toast } = useToast();

  const [cities, setCities] = useState("");
  const [zipCodes, setZipCodes] = useState("");

  useEffect(() => {
    if (prefs) {
      setCities(prefs.cities.join(", "));
      setZipCodes(prefs.zipCodes.join(", "));
    }
  }, [prefs]);

  const handleSave = () => {
    const cityArray = cities.split(",").map(s => s.trim()).filter(Boolean);
    const zipArray = zipCodes.split(",").map(s => s.trim()).filter(Boolean);

    updatePrefs(
      { data: { cities: cityArray, zipCodes: zipArray } },
      {
        onSuccess: () => toast({ title: "Radar Updated", description: "Your location preferences have been saved." }),
        onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to save preferences. Try again." }),
      }
    );
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

      <h1 className="text-5xl font-display tracking-wide text-foreground">Your <span className="text-primary">Profile</span></h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* User Card */}
        <div className="md:col-span-1">
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-32 h-32 mx-auto rounded-full bg-muted border-4 border-background shadow-xl mb-6 relative z-10 flex items-center justify-center overflow-hidden">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={user.username ?? ""} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">@{user.username}</h2>
            {user.isAdmin && (
              <span className="inline-block bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mt-2">Admin</span>
            )}
            <div className="mt-8 pt-6 border-t border-border/50 text-left">
              <div className="text-sm text-muted-foreground font-medium mb-1">Shows Attended</div>
              <div className="font-bold text-foreground text-2xl">{history?.length ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Preferences Form */}
        <div className="md:col-span-2">
          <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="text-2xl font-display text-foreground leading-none">Radar Settings</h3>
                <p className="text-sm text-muted-foreground font-medium mt-1">Configure where we look for shows.</p>
              </div>
            </div>

            {loadingPrefs ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> Target Cities
                  </label>
                  <input
                    type="text"
                    value={cities}
                    onChange={(e) => setCities(e.target.value)}
                    placeholder="Austin, Chicago, Seattle..."
                    className="w-full bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-medium"
                  />
                  <p className="text-xs text-muted-foreground">Comma separated list of cities to track.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" /> Target Zip Codes
                  </label>
                  <input
                    type="text"
                    value={zipCodes}
                    onChange={(e) => setZipCodes(e.target.value)}
                    placeholder="78701, 60601..."
                    className="w-full bg-background border-2 border-border focus:border-secondary focus:ring-4 focus:ring-secondary/10 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-medium"
                  />
                  <p className="text-xs text-muted-foreground">Comma separated list of zip codes to track.</p>
                </div>

                <div className="pt-6 border-t border-border/50">
                  <button
                    onClick={handleSave}
                    disabled={savingPrefs}
                    className="w-full sm:w-auto px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {savingPrefs ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Radar Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show History */}
      <div>
        <h2 className="text-3xl font-display text-foreground mb-6">Show <span className="text-secondary">History</span></h2>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !history?.length ? (
          <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-lg">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-2xl font-display text-foreground mb-2">No shows yet</h3>
            <p className="text-muted-foreground">Mark shows as attending and they'll appear here once the date passes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(show => (
              <div key={show.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg flex gap-4 hover:border-secondary/30 transition-colors">
                <div className="w-14 h-14 bg-secondary/10 border border-secondary/20 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-secondary font-display text-xs leading-none">{format(parseISO(show.showDate), "MMM")}</span>
                  <span className="text-foreground font-display text-2xl leading-none">{format(parseISO(show.showDate), "dd")}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {show.artist && <div className="text-secondary font-display tracking-widest text-xs mb-0.5">{show.artist}</div>}
                      <h4 className="font-display text-lg text-foreground leading-tight">{show.title}</h4>
                      <p className="text-sm text-muted-foreground">{show.venueName} · {show.venueCity}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" title="Attended" />
                  </div>

                  {show.friendsWhoAttended.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Also went:{" "}
                        <span className="text-foreground font-semibold">
                          {show.friendsWhoAttended.map(f => `@${f.username}`).join(", ")}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
