import { Router, type IRouter } from "express";
import { z } from "zod";
import { fetchTicketmasterEvents, syncTicketmasterToDb, recentSyncs } from "../lib/ticketmaster";

const router: IRouter = Router();

const SyncBody = z.object({
  city: z.string().optional(),
  postalCode: z.string().optional(),
}).refine(d => d.city || d.postalCode, { message: "city or postalCode is required" });

// Admin: force a fresh sync (bypasses the 1-hour cooldown)
router.post("/ticketmaster/sync", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = SyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Admin manual syncs bypass cooldown and fetch more pages for thorough coverage
  recentSyncs.delete(`${parsed.data.city?.toLowerCase() ?? ""}:${parsed.data.postalCode ?? ""}:${parsed.data.radius ?? ""}`);
  const result = await syncTicketmasterToDb({ ...parsed.data, maxPages: 5 });
  res.json(result);
});

// Admin: preview raw Ticketmaster events without importing
router.get("/ticketmaster/preview", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const city = req.query.city as string | undefined;
  const postalCode = req.query.postalCode as string | undefined;

  if (!city && !postalCode) {
    res.status(400).json({ error: "city or postalCode is required" });
    return;
  }

  try {
    const events = await fetchTicketmasterEvents({ city, postalCode, size: 10 });
    res.json(events.slice(0, 10));
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? "Failed to fetch from Ticketmaster" });
  }
});

export default router;
