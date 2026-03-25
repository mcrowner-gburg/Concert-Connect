import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db, venuesTable, showsTable } from "@workspace/db";
import { fetchTicketmasterEvents } from "../lib/ticketmaster";

const router: IRouter = Router();

const SyncBody = z.object({
  city: z.string().optional(),
  postalCode: z.string().optional(),
}).refine(d => d.city || d.postalCode, { message: "city or postalCode is required" });

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

  const { city, postalCode } = parsed.data;

  let events;
  try {
    events = await fetchTicketmasterEvents({ city, postalCode });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? "Failed to fetch from Ticketmaster" });
    return;
  }

  let showsAdded = 0;
  let showsSkipped = 0;
  let venuesCreated = 0;

  for (const event of events) {
    if (!event.localDate || !event.venue.city) continue;

    // Find or create venue
    const [existingVenue] = await db
      .select()
      .from(venuesTable)
      .where(
        and(
          sql`lower(${venuesTable.name}) = lower(${event.venue.name})`,
          sql`lower(${venuesTable.city}) = lower(${event.venue.city})`
        )
      )
      .limit(1);

    let venueId: number;
    if (existingVenue) {
      venueId = existingVenue.id;
    } else {
      const [newVenue] = await db.insert(venuesTable).values({
        name: event.venue.name,
        city: event.venue.city,
        state: event.venue.state ?? undefined,
        zipCode: event.venue.postalCode ?? undefined,
        websiteUrl: event.venue.url ?? `https://www.ticketmaster.com`,
        scrapeUrl: null,
        isActive: false,
      }).returning();
      venueId = newVenue.id;
      venuesCreated++;
    }

    // Determine show date
    const showDate = event.dateTime ?? new Date(`${event.localDate}T${event.localTime ?? "20:00:00"}`);

    // Deduplicate by Ticketmaster event ID stored in sourceUrl, or by title+venue+date
    const [existingShow] = await db
      .select({ id: showsTable.id })
      .from(showsTable)
      .where(
        and(
          eq(showsTable.venueId, venueId),
          sql`lower(${showsTable.title}) = lower(${event.name})`,
          sql`date(${showsTable.showDate}) = date(${showDate.toISOString()})`
        )
      )
      .limit(1);

    if (existingShow) {
      showsSkipped++;
      continue;
    }

    const priceStr = event.ticketPriceMin !== null
      ? event.ticketPriceMax !== null && event.ticketPriceMax !== event.ticketPriceMin
        ? `$${event.ticketPriceMin} – $${event.ticketPriceMax}`
        : `$${event.ticketPriceMin}`
      : null;

    await db.insert(showsTable).values({
      venueId,
      title: event.name,
      artist: event.artist ?? undefined,
      description: event.description ?? undefined,
      showDate,
      showTime: event.localTime ?? undefined,
      ticketUrl: event.ticketUrl || undefined,
      ticketPrice: priceStr ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
      sourceUrl: `https://www.ticketmaster.com/event/${event.id}`,
    });

    showsAdded++;
  }

  res.json({
    eventsFound: events.length,
    showsAdded,
    showsSkipped,
    venuesCreated,
  });
});

// Preview: return raw Ticketmaster events without importing
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
