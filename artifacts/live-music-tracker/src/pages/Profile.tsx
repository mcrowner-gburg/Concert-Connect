import { useState, useEffect } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetUserPreferences, useUpdateUserPreferences } from "@workspace/api-client-react";
import { Settings, MapPin, Hash, Save, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Profile() {
  const { user } = useAuth();
  const { data: prefs, isLoading: loadingPrefs } = useGetUserPreferences();
  const { mutate: updatePrefs, isPending: savingPrefs } = useUpdateUserPreferences();
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
        onSuccess: () => {
          toast({
            title: "Radar Updated",
            description: "Your location preferences have been saved.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to save preferences. Try again.",
          });
        }
      }
    );
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">Your <span className="text-primary">Profile</span></h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* User Card */}
        <div className="md:col-span-1">
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="w-32 h-32 mx-auto rounded-full bg-muted border-4 border-background shadow-xl mb-6 relative z-10 flex items-center justify-center overflow-hidden">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-1">@{user.username}</h2>
            {user.isAdmin && (
              <span className="inline-block bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mt-2">
                Admin
              </span>
            )}
            
            <div className="mt-8 pt-6 border-t border-border/50 text-left">
              <div className="text-sm text-muted-foreground font-medium mb-1">Member Since</div>
              <div className="font-bold text-foreground">{new Date(user.createdAt).toLocaleDateString()}</div>
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
    </div>
  );
}
