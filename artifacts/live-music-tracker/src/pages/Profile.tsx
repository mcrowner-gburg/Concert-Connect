import { useState, useEffect, useRef } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetUserPreferences, useUpdateUserPreferences } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, MapPin, Hash, Save, Loader2, User, CheckCircle2, Users, Camera, Pencil, X, Check } from "lucide-react";
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cities, setCities] = useState("");
  const [zipCodes, setZipCodes] = useState("");

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (prefs) {
      setCities(prefs.cities.join(", "));
      setZipCodes(prefs.zipCodes.join(", "));
    }
  }, [prefs]);

  useEffect(() => {
    if (user && editingProfile) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setUsername(user.username ?? "");
    }
  }, [user, editingProfile]);

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

  const updateProfile = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; username?: string; profileImageUrl?: string | null }) => {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile Updated", description: "Your profile has been saved." });
      setEditingProfile(false);
      // Refresh auth user
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Force re-fetch of auth user to update the header
      fetch("/api/auth/user", { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            // Re-trigger auth context update by dispatching storage event
            window.dispatchEvent(new Event("auth-updated"));
          }
        });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      username: username || undefined,
    });
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please select an image file." });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Get presigned upload URL
      const urlRes = await fetch("/api/users/upload-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, filename: file.name }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Could not get upload URL");
      }

      const { uploadUrl, publicUrl } = await urlRes.json();

      // Upload directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      // Save the new URL to the user's profile
      await updateProfile.mutateAsync({ profileImageUrl: publicUrl });
      toast({ title: "Avatar Updated", description: "Your profile photo has been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  const memberSince = user.createdAt ? format(parseISO(user.createdAt), "MMM yyyy") : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

      <h1 className="text-5xl font-display tracking-wide text-foreground">Your <span className="text-primary">Profile</span></h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* User Card */}
        <div className="md:col-span-1">
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Avatar with upload button */}
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-32 h-32 rounded-full bg-muted border-4 border-background shadow-xl relative z-10 flex items-center justify-center overflow-hidden">
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={user.username ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 z-20 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Change photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Name / username display or edit */}
            {editingProfile ? (
              <div className="space-y-2 text-left mb-4">
                <div className="flex gap-2">
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveProfile}
                    disabled={updateProfile.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updateProfile.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-muted text-muted-foreground text-xs font-bold py-1.5 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                {(user.firstName || user.lastName) && (
                  <div className="text-lg font-semibold text-foreground leading-tight">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                  </div>
                )}
                <h2 className="text-xl font-bold text-muted-foreground">@{user.username}</h2>
                <button
                  onClick={() => setEditingProfile(true)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit profile
                </button>
              </div>
            )}

            {user.isAdmin && (
              <span className="inline-block bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Admin</span>
            )}

            <div className="mt-6 pt-6 border-t border-border/50 text-left space-y-4">
              <div>
                <div className="text-sm text-muted-foreground font-medium mb-1">Shows Attended</div>
                <div className="font-bold text-foreground text-2xl">{history?.length ?? 0}</div>
              </div>
              {memberSince && (
                <div>
                  <div className="text-sm text-muted-foreground font-medium mb-1">Member Since</div>
                  <div className="font-semibold text-foreground">{memberSince}</div>
                </div>
              )}
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
