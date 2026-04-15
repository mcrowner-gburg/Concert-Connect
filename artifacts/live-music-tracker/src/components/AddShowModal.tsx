import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useListVenues, getListShowsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
import {
  X, Plus, Loader2, Music, MapPin, Calendar, Clock, Ticket, Link,
  DollarSign, FileText, Upload, CheckCircle, AlertTriangle, XCircle,
} from "lucide-react";
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
  title: "", artist: "", venueId: "", showDate: "", showTime: "",
  doorsTime: "", description: "", ticketUrl: "", ticketPrice: "",
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

interface PreviewRow {
  rowIndex: number;
  artist: string;
  showDate: string;
  rawVenue: string;
  matchedVenue: { id: number; name: string; city: string } | null;
  description: string | null;
  isDuplicate: boolean;
  willImport: boolean;
}

interface PreviewResult {
  rows: PreviewRow[];
  summary: { total: number; willImport: number; unmatched: number; duplicates: number };
}

type ModalTab = "manual" | "import";

export function AddShowModal({ open, onClose }: AddShowModalProps) {
  const [tab, setTab] = useState<ModalTab>("manual");
  const [form, setForm] = useState<FormState>(empty);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
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

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    if (!form.venueId) return toast({ title: "Please select a venue", variant: "destructive" });
    if (!form.showDate) return toast({ title: "Date is required", variant: "destructive" });
    mutate(form);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/shows/import/preview", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(err.error ?? "Failed to parse file");
      }
      setPreview(await res.json());
    } catch (err: any) {
      toast({ title: "File error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    const shows = preview.rows.filter(r => r.willImport).map(r => ({
      artist: r.artist,
      showDate: r.showDate,
      venueId: r.matchedVenue!.id,
      description: r.description,
    }));
    setImporting(true);
    try {
      const res = await fetch("/api/admin/shows/import/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shows }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Import failed");
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: getListShowsQueryKey() });
      toast({ title: "Import complete", description: `Added ${result.imported} shows${result.skipped > 0 ? `, skipped ${result.skipped}` : ""}.` });
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onClose();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const inputClass = "w-full bg-background border border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl py-2.5 px-4 text-foreground placeholder:text-muted-foreground transition-all outline-none text-sm font-medium";
  const labelClass = "flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
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
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tab === "manual" ? "You'll automatically be marked as going." : "Import multiple shows from a spreadsheet."}
                </p>
              </div>
              <button onClick={handleClose} className="p-2 text-muted-foreground hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs (admin only sees Import tab) */}
            {user?.isAdmin && (
              <div className="flex gap-1 mx-6 mt-4 bg-background/50 border border-border/50 rounded-xl p-1 w-fit">
                {([["manual", "Manual Entry"], ["import", "Import File"]] as [ModalTab, string][]).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === t ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* ── MANUAL ENTRY ──────────────────────────────────── */}
            {tab === "manual" && (
              <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
                <div className="px-6 py-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}><Music className="w-3.5 h-3.5" /> Show Title *</label>
                      <input type="text" placeholder="e.g. Hozier Live" value={form.title} onChange={set("title")} required className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}><Music className="w-3.5 h-3.5" /> Artist / Band</label>
                      <input type="text" placeholder="e.g. Hozier" value={form.artist} onChange={set("artist")} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}><MapPin className="w-3.5 h-3.5" /> Venue *</label>
                    {loadingVenues ? (
                      <div className="flex items-center gap-2 py-2.5 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading venues...</div>
                    ) : (
                      <select value={form.venueId} onChange={set("venueId")} required className={`${inputClass} cursor-pointer`}>
                        <option value="">Select a venue...</option>
                        {venues?.map(v => (
                          <option key={v.id} value={v.id}>{v.name} — {v.city}{v.state ? `, ${v.state}` : ""}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}><Calendar className="w-3.5 h-3.5" /> Date *</label>
                      <input type="date" value={form.showDate} onChange={set("showDate")} required className={`${inputClass} cursor-pointer`} />
                    </div>
                    <div>
                      <label className={labelClass}><Clock className="w-3.5 h-3.5" /> Show Time</label>
                      <input type="time" value={form.showTime} onChange={set("showTime")} className={`${inputClass} cursor-pointer`} />
                    </div>
                    <div>
                      <label className={labelClass}><Clock className="w-3.5 h-3.5" /> Doors Time</label>
                      <input type="time" value={form.doorsTime} onChange={set("doorsTime")} className={`${inputClass} cursor-pointer`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}><Link className="w-3.5 h-3.5" /> Ticket URL</label>
                      <input type="url" placeholder="https://..." value={form.ticketUrl} onChange={set("ticketUrl")} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}><DollarSign className="w-3.5 h-3.5" /> Ticket Price</label>
                      <input type="text" placeholder="e.g. $35 – $75" value={form.ticketPrice} onChange={set("ticketPrice")} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}><FileText className="w-3.5 h-3.5" /> Description</label>
                    <textarea rows={3} placeholder="Tell your friends about the show..." value={form.description} onChange={set("description")} className={`${inputClass} resize-none`} />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-background/30">
                  <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">Cancel</button>
                  <button type="submit" disabled={isPending} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {isPending ? "Adding..." : "Add Show"}
                  </button>
                </div>
              </form>
            )}

            {/* ── IMPORT FILE ───────────────────────────────────── */}
            {tab === "import" && (
              <div className="overflow-y-auto flex-1 flex flex-col">
                <div className="px-6 py-5 space-y-5 flex-1">

                  {/* Drop zone */}
                  <div
                    className="relative border-2 border-dashed border-border/60 hover:border-primary/50 rounded-2xl p-8 text-center cursor-pointer transition-colors group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.tsv"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary mx-auto mb-3 transition-colors" />
                    <p className="text-sm font-bold text-foreground">Click to upload or drag & drop</p>
                    <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx), CSV, or tab-separated text</p>
                    <p className="text-xs text-muted-foreground mt-3 font-mono opacity-60">
                      Required columns: <span className="text-foreground/60">date · show · venue</span>
                    </p>
                  </div>

                  {loadingPreview && (
                    <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" /> Parsing file...
                    </div>
                  )}

                  {/* Summary bar */}
                  {preview && (
                    <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex flex-wrap gap-5 text-sm">
                      {[
                        { label: "Will import", val: preview.summary.willImport, color: "text-green-400", icon: <CheckCircle className="w-4 h-4" /> },
                        { label: "Unmatched venues", val: preview.summary.unmatched, color: "text-amber-400", icon: <AlertTriangle className="w-4 h-4" /> },
                        { label: "Duplicates", val: preview.summary.duplicates, color: "text-muted-foreground", icon: <XCircle className="w-4 h-4" /> },
                      ].map(({ label, val, color, icon }) => (
                        <div key={label} className={`flex items-center gap-2 ${color}`}>
                          {icon}
                          <span className="font-bold">{val}</span>
                          <span className="text-muted-foreground font-medium">{label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview table */}
                  {preview && preview.rows.length > 0 && (
                    <div className="border border-border/50 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-card">
                            <tr className="bg-white/5 text-muted-foreground uppercase tracking-wider border-b border-border/50">
                              <th className="p-3">Status</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Artist</th>
                              <th className="p-3">Venue (file)</th>
                              <th className="p-3">Matched to</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {preview.rows.map(row => (
                              <tr key={row.rowIndex} className={`transition-colors ${row.willImport ? "hover:bg-white/[0.02]" : "opacity-50"}`}>
                                <td className="p-3">
                                  {row.isDuplicate
                                    ? <span title="Duplicate"><XCircle className="w-4 h-4 text-muted-foreground" /></span>
                                    : !row.matchedVenue
                                      ? <span title="Venue not found"><AlertTriangle className="w-4 h-4 text-amber-400" /></span>
                                      : <CheckCircle className="w-4 h-4 text-green-400" />
                                  }
                                </td>
                                <td className="p-3 font-mono text-foreground/80">{row.showDate}</td>
                                <td className="p-3 font-bold text-foreground">{row.artist}</td>
                                <td className="p-3 text-muted-foreground">{row.rawVenue}</td>
                                <td className="p-3 text-foreground/80">
                                  {row.matchedVenue ? `${row.matchedVenue.name} · ${row.matchedVenue.city}` : <span className="text-amber-400 italic">Not found</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-background/30">
                  <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">Cancel</button>
                  {preview && preview.summary.willImport > 0 && (
                    <button
                      onClick={handleConfirmImport}
                      disabled={importing}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                    >
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {importing ? "Importing..." : `Import ${preview.summary.willImport} Show${preview.summary.willImport !== 1 ? "s" : ""}`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
