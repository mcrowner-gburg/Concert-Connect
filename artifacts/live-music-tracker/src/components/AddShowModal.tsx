import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useListVenues, getListShowsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, Loader2, Music, MapPin, Calendar, Clock, Ticket, Link, DollarSign, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AddShowModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  title: string;
  artist: string;
  venueId: string;
  showDate: string;
  showTime: string;
  doorsTime: string;
  description: string;
  ticketUrl: string;
  ticketPrice: string;
}

const empty: FormState = {
  title: "",
  artist: "",
  venueId: "",
  showDate: "",
  showTime: "",
  doorsTime: "",
  description: "",
  ticketUrl: "",
  ticketPrice: "",
};

async function createShow(data: FormState) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/shows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      title: data.title.trim(),
      artist: data.artist.trim() || undefined,
      venueId: Number(data.venueId),
      showDate: data.showDate ? new Date(data.showDate).toISOString() : undefined,
      showTime: data.showTime || undefined,
      doorsTime: data.doorsTime || undefined,
      description: data.description.trim() || undefined,
      ticketUrl: data.ticketUrl.trim() || undefined,
      ticketPrice: data.ticketPrice.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to create show");
  }
  return res.json();
}

export function AddShowModal({ open, onClose }: AddShowModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: venues, isLoading: loadingVenues } = useListVenues();

  const { mutate, isPending } = useMutation({
    mutationFn: createShow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListShowsQueryKey() });
      toast({ title: "Show added!", description: `"${form.title}" has been added and you're marked as going.` });
      setForm(empty);
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't add show", description: err.message, variant: "destructive" });
    },
  });

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    if (!form.venueId) return toast({ title: "Please select a venue", variant: "destructive" });
    if (!form.showDate) return toast({ title: "Date is required", variant: "destructive" });
    mutate(form);
  };

  const inputClass = "w-full bg-background border border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl py-2.5 px-4 text-foreground placeholder:text-muted-foreground transition-all outline-none text-sm font-medium";
  const labelClass = "flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-2xl bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-display text-white">Add a Show</h2>
                <p className="text-sm text-muted-foreground mt-0.5">You'll automatically be marked as going.</p>
              </div>
              <button onClick={onClose} className="p-2 text-muted-foreground hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="px-6 py-5 space-y-5">

                {/* Title + Artist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}><Music className="w-3.5 h-3.5" /> Show Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Hozier Live"
                      value={form.title}
                      onChange={set("title")}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}><Music className="w-3.5 h-3.5" /> Artist / Band</label>
                    <input
                      type="text"
                      placeholder="e.g. Hozier"
                      value={form.artist}
                      onChange={set("artist")}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Venue */}
                <div>
                  <label className={labelClass}><MapPin className="w-3.5 h-3.5" /> Venue *</label>
                  {loadingVenues ? (
                    <div className="flex items-center gap-2 py-2.5 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading venues...
                    </div>
                  ) : (
                    <select
                      value={form.venueId}
                      onChange={set("venueId")}
                      required
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="">Select a venue...</option>
                      {venues?.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.city}{v.state ? `, ${v.state}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Date + Times */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}><Calendar className="w-3.5 h-3.5" /> Date *</label>
                    <input
                      type="date"
                      value={form.showDate}
                      onChange={set("showDate")}
                      required
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}><Clock className="w-3.5 h-3.5" /> Show Time</label>
                    <input
                      type="time"
                      value={form.showTime}
                      onChange={set("showTime")}
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}><Clock className="w-3.5 h-3.5" /> Doors Time</label>
                    <input
                      type="time"
                      value={form.doorsTime}
                      onChange={set("doorsTime")}
                      className={`${inputClass} cursor-pointer`}
                    />
                  </div>
                </div>

                {/* Ticket Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}><Link className="w-3.5 h-3.5" /> Ticket URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.ticketUrl}
                      onChange={set("ticketUrl")}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}><DollarSign className="w-3.5 h-3.5" /> Ticket Price</label>
                    <input
                      type="text"
                      placeholder="e.g. $35 – $75"
                      value={form.ticketPrice}
                      onChange={set("ticketPrice")}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={labelClass}><FileText className="w-3.5 h-3.5" /> Description</label>
                  <textarea
                    rows={3}
                    placeholder="Tell your friends about the show..."
                    value={form.description}
                    onChange={set("description")}
                    className={`${inputClass} resize-none`}
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-background/30">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isPending ? "Adding..." : "Add Show"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
