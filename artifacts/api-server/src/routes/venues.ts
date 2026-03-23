import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, venuesTable, showsTable } from "@workspace/db";
import {
  ListVenuesResponse,
  GetVenueResponse,
  CreateVenueBody,
  UpdateVenueBody,
  GetVenueParams,
  UpdateVenueParams,
  DeleteVenueParams,
  ScrapeVenueParams,
  ScrapeVenueResponse,
  ScrapeAllVenuesResponse,
} from "@workspace/api-zod";
import { scrapeVenueSite } from "../lib/scraper";

const router: IRouter = Router();

function mapVenue(v: typeof venuesTable.$inferSelect) {
  return {
    id: v.id,
    name: v.name,
    city: v.city,
    state: v.state,
    zipCode: v.zipCode,
    websiteUrl: v.websiteUrl,
    scrapeUrl: v.scrapeUrl,
    isActive: v.isActive,
    lastScrapedAt: v.lastScrapedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

router.get("/venues", async (req, res): Promise<void> => {
  const venues = await db.select().from(venuesTable).orderBy(venuesTable.name);
  res.json(ListVenuesResponse.parse(venues.map(mapVenue)));
});

router.post("/venues", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateVenueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [venue] = await db.insert(venuesTable).values({
    name: parsed.data.name,
    city: parsed.data.city,
    state: parsed.data.state ?? null,
    zipCode: parsed.data.zipCode ?? null,
    websiteUrl: parsed.data.websiteUrl,
    scrapeUrl: parsed.data.scrapeUrl ?? null,
    isActive: parsed.data.isActive ?? true,
  }).returning();

  res.status(201).json(GetVenueResponse.parse(mapVenue(venue)));
});

router.get("/venues/:id", async (req, res): Promise<void> => {
  const params = GetVenueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [venue] = await db.select().from(venuesTable).where(eq(venuesTable.id, params.data.id));
  if (!venue) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  res.json(GetVenueResponse.parse(mapVenue(venue)));
});

router.patch("/venues/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = UpdateVenueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVenueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof venuesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.city !== undefined) updateData.city = parsed.data.city;
  if (parsed.data.state !== undefined) updateData.state = parsed.data.state;
  if (parsed.data.zipCode !== undefined) updateData.zipCode = parsed.data.zipCode;
  if (parsed.data.websiteUrl !== undefined) updateData.websiteUrl = parsed.data.websiteUrl;
  if (parsed.data.scrapeUrl !== undefined) updateData.scrapeUrl = parsed.data.scrapeUrl;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [venue] = await db.update(venuesTable).set(updateData).where(eq(venuesTable.id, params.data.id)).returning();
  if (!venue) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  res.json(GetVenueResponse.parse(mapVenue(venue)));
});

router.delete("/venues/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = DeleteVenueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(venuesTable).where(eq(venuesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/venues/:id/scrape", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = ScrapeVenueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [venue] = await db.select().from(venuesTable).where(eq(venuesTable.id, params.data.id));
  if (!venue) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const result = await scrapeVenueSite(venue);

  await db.update(venuesTable).set({ lastScrapedAt: new Date() }).where(eq(venuesTable.id, venue.id));

  res.json(ScrapeVenueResponse.parse({
    venueId: result.venueId,
    venueName: result.venueName,
    showsFound: result.showsFound,
    showsAdded: result.showsAdded,
    errors: result.errors,
  }));
});

router.post("/venues/scrape-all", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const venues = await db.select().from(venuesTable).where(eq(venuesTable.isActive, true));
  const results = await Promise.all(venues.map(v => scrapeVenueSite(v)));

  for (const v of venues) {
    await db.update(venuesTable).set({ lastScrapedAt: new Date() }).where(eq(venuesTable.id, v.id));
  }

  const totalShowsFound = results.reduce((s, r) => s + r.showsFound, 0);
  const totalShowsAdded = results.reduce((s, r) => s + r.showsAdded, 0);

  res.json(ScrapeAllVenuesResponse.parse({
    totalShowsFound,
    totalShowsAdded,
    venuesScraped: venues.length,
    results,
  }));
});

export default router;
