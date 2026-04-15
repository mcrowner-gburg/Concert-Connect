import { and, sql, eq } from "drizzle-orm";
import { db, venuesTable, showsTable } from "@workspace/db";

export interface TMVenue {
  name: string;
  city: string;
  state: string | null;
  postalCode: string | null;
  url: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface TMEvent {
  id: string;
  name: string;
  artist: string | null;
  dateTime: Date | null;
  localDate: string;
  localTime: string | null;
  venue: TMVenue;
  ticketUrl: string;
  ticketPriceMin: number | null;
  ticketPriceMax: number | null;
  imageUrl: string | null;
  description: string | null;
}

export interface SyncResult {
  eventsFound: number;
  showsAdded: number;
  showsSkipped: number;
  venuesCreated: number;
}

function parseTMEvent(e: any): TMEvent {
  const tmVenue = e._embedded?.venues?.[0];
  const attraction = e._embedded?.attractions?.[0];
  const price = e.priceRanges?.[0];
  const localDate: string = e.dates?.start?.localDate ?? "";
  const localTime: string | null = e.dates?.start?.localTime ?? null;
  const dateTimeStr: string | null = e.dates?.start?.dateTime ?? null;
  const bestImage = (e.images ?? [])
    .filter((img: any) => img.ratio === "16_9")
    .sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))[0];
  return {
    id: e.id,
    name: e.name ?? "Untitled Event",
    artist: attraction?.name ?? null,
    dateTime: dateTimeStr ? new Date(dateTimeStr) : null,
    localDate,
    localTime: localTime ? localTime.slice(0, 5) : null,
    venue: {
      name: tmVenue?.name ?? "Unknown Venue",
      city: tmVenue?.city?.name ?? "",
      state: tmVenue?.state?.stateCode ?? null,
      postalCode: tmVenue?.postalCode ?? null,
      url: tmVenue?.url ?? null,
      latitude: tmVenue?.location?.latitude ?? null,
      longitude: tmVenue?.location?.longitude ?? null,
    },
    ticketUrl: e.url ?? "",
    ticketPriceMin: price?.min ?? null,
    ticketPriceMax: price?.max ?? null,
    imageUrl: bestImage?.url ?? null,
    description: null,
  };
}

export async function fetchTicketmasterEvents(params: {
  city?: string;
  postalCode?: string;
  radius?: number;
  size?: number;
  maxPages?: number;
}): Promise<TMEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) throw new Error("TICKETMASTER_API_KEY is not configured");

  const { city, postalCode, radius, size = 200, maxPages = 1 } = params;
  if (!city && !postalCode) throw new Error("city or postalCode is required");

  const allEvents: TMEvent[] = [];

  for (let page = 0; page < maxPages; page++) {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const query = new URLSearchParams({
      apikey: apiKey,
      classificationName: "Music",
      size: String(size),
      sort: "date,asc",
      startDateTime: now,
      countryCode: "US",
      page: String(page),
    });

    if (city) query.set("city", city);
    if (postalCode) query.set("postalCode", postalCode);
    // radius only meaningful for zip code searches; Ticketmaster default is 50 miles
    if (postalCode && radius) {
      query.set("radius", String(radius));
      query.set("unit", "miles");
    }

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${query.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ticketmaster API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const events: any[] = data?._embedded?.events ?? [];
    const totalPages: number = data?.page?.totalPages ?? 1;

    allEvents.push(...events.map(parseTMEvent));

    // Stop early if we've reached the last page or got no results
    if (events.length === 0 || page >= totalPages - 1) break;
  }

  return allEvents;
}

// In-memory cooldown: don't re-sync the same city/zip within 1 hour
export const recentSyncs = new Map<string, number>();
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export async function syncTicketmasterToDb(params: { city?: string; postalCode?: string; radius?: number; maxPages?: number }): Promise<SyncResult> {
  const key = `${params.city?.toLowerCase() ?? ""}:${params.postalCode ?? ""}:${params.radius ?? ""}`;
  const lastSync = recentSyncs.get(key);
  if (lastSync && Date.now() - lastSync < SYNC_COOLDOWN_MS) {
    return { eventsFound: 0, showsAdded: 0, showsSkipped: 0, venuesCreated: 0 };
  }

  recentSyncs.set(key, Date.now());

  let events: TMEvent[];
  try {
    events = await fetchTicketmasterEvents({ city: params.city, postalCode: params.postalCode, radius: params.radius, maxPages: params.maxPages ?? 2 });
  } catch {
    return { eventsFound: 0, showsAdded: 0, showsSkipped: 0, venuesCreated: 0 };
  }

  let showsAdded = 0;
  let showsSkipped = 0;
  let venuesCreated = 0;

  for (const event of events) {
    if (!event.localDate || !event.venue.city) continue;

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
        websiteUrl: event.venue.url ?? "https://www.ticketmaster.com",
        scrapeUrl: null,
        isActive: false,
      }).returning();
      venueId = newVenue.id;
      venuesCreated++;
    }

    const showDate = event.dateTime ?? new Date(`${event.localDate}T${event.localTime ?? "20:00:00"}`);
    const sourceUrl = `https://www.ticketmaster.com/event/${event.id}`;

    const priceStr = event.ticketPriceMin !== null
      ? event.ticketPriceMax !== null && event.ticketPriceMax !== event.ticketPriceMin
        ? `$${event.ticketPriceMin} – $${event.ticketPriceMax}`
        : `$${event.ticketPriceMin}`
      : null;

    const result = await db.insert(showsTable).values({
      venueId,
      title: event.name,
      artist: event.artist ?? undefined,
      showDate,
      showTime: event.localTime ?? undefined,
      ticketUrl: event.ticketUrl || undefined,
      ticketPrice: priceStr ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
      sourceUrl,
    }).onConflictDoNothing().returning({ id: showsTable.id });

    if (result.length > 0) {
      showsAdded++;
    } else {
      showsSkipped++;
    }
  }

  return { eventsFound: events.length, showsAdded, showsSkipped, venuesCreated };
}
