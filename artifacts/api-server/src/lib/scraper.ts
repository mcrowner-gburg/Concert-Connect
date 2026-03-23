import { db, showsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

interface ScrapeResult {
  venueId: number;
  venueName: string;
  showsFound: number;
  showsAdded: number;
  errors: string[];
}

interface ScrapedShow {
  title: string;
  artist: string | null;
  description: string | null;
  showDate: Date;
  doorsTime: string | null;
  showTime: string | null;
  ticketUrl: string | null;
  ticketPrice: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LiveMusicTracker/1.0)",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}

function extractTextBetween(html: string, startTag: string, endTag: string): string[] {
  const results: string[] = [];
  let pos = 0;
  while (true) {
    const start = html.indexOf(startTag, pos);
    if (start === -1) break;
    const contentStart = start + startTag.length;
    const end = html.indexOf(endTag, contentStart);
    if (end === -1) break;
    const content = html.slice(contentStart, end).replace(/<[^>]+>/g, "").trim();
    if (content) results.push(content);
    pos = end + endTag.length;
  }
  return results;
}

function parseDate(dateStr: string): Date | null {
  try {
    const cleaned = dateStr.replace(/\s+/g, " ").trim();
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonLd(html: string): ScrapedShow[] {
  const shows: ScrapedShow[] = [];
  const jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "Event" || item["@type"] === "MusicEvent") {
          const startDate = item.startDate ? parseDate(item.startDate) : null;
          if (!startDate) continue;
          shows.push({
            title: item.name || item.headline || "Untitled Show",
            artist: item.performer?.name ?? item.performer?.[0]?.name ?? null,
            description: item.description ? stripHtml(item.description).slice(0, 500) : null,
            showDate: startDate,
            doorsTime: null,
            showTime: item.startDate ? new Date(item.startDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : null,
            ticketUrl: item.url ?? item.offers?.url ?? null,
            ticketPrice: item.offers?.price ? `$${item.offers.price}` : null,
            imageUrl: typeof item.image === "string" ? item.image : item.image?.url ?? null,
            sourceUrl: item.url ?? null,
          });
        }
      }
    } catch {
      // invalid JSON, skip
    }
  }
  return shows;
}

function extractFromHtml(html: string, sourceUrl: string): ScrapedShow[] {
  const shows: ScrapedShow[] = [];

  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
  ];

  const foundDates: Date[] = [];
  for (const pattern of datePatterns) {
    const matches = html.matchAll(pattern);
    for (const m of matches) {
      const d = parseDate(m[0]);
      if (d && d > new Date()) foundDates.push(d);
    }
  }

  const titlePatterns = [
    /<h[123][^>]*class="[^"]*(?:event|show|title|name)[^"]*"[^>]*>([\s\S]*?)<\/h[123]>/gi,
    /<a[^>]*class="[^"]*(?:event|show|title)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  const foundTitles: string[] = [];
  for (const pattern of titlePatterns) {
    const matches = html.matchAll(pattern);
    for (const m of matches) {
      const t = stripHtml(m[1]).slice(0, 200);
      if (t.length > 2) foundTitles.push(t);
    }
  }

  const count = Math.min(foundDates.length, foundTitles.length, 20);
  for (let i = 0; i < count; i++) {
    shows.push({
      title: foundTitles[i],
      artist: null,
      description: null,
      showDate: foundDates[i],
      doorsTime: null,
      showTime: null,
      ticketUrl: sourceUrl,
      ticketPrice: null,
      imageUrl: null,
      sourceUrl,
    });
  }

  return shows;
}

export async function scrapeVenueSite(venue: { id: number; name: string; websiteUrl: string; scrapeUrl: string | null }): Promise<ScrapeResult> {
  const errors: string[] = [];
  let showsFound = 0;
  let showsAdded = 0;

  const urlToScrape = venue.scrapeUrl || venue.websiteUrl;

  try {
    const html = await fetchPage(urlToScrape);

    let shows = extractJsonLd(html);

    if (shows.length === 0) {
      shows = extractFromHtml(html, urlToScrape);
    }

    showsFound = shows.length;

    for (const show of shows) {
      try {
        const existingShows = await db.select({ id: showsTable.id }).from(showsTable)
          .where(and(
            eq(showsTable.venueId, venue.id),
            eq(showsTable.title, show.title),
          ))
          .limit(1);

        if (existingShows.length === 0) {
          await db.insert(showsTable).values({
            venueId: venue.id,
            title: show.title,
            artist: show.artist,
            description: show.description,
            showDate: show.showDate,
            doorsTime: show.doorsTime,
            showTime: show.showTime,
            ticketUrl: show.ticketUrl,
            ticketPrice: show.ticketPrice,
            imageUrl: show.imageUrl,
            sourceUrl: show.sourceUrl,
          });
          showsAdded++;
        }
      } catch (err) {
        errors.push(`Failed to save show "${show.title}": ${String(err)}`);
      }
    }
  } catch (err) {
    const msg = `Failed to scrape ${venue.name}: ${String(err)}`;
    errors.push(msg);
    logger.warn({ venueId: venue.id, err }, msg);
  }

  return { venueId: venue.id, venueName: venue.name, showsFound, showsAdded, errors };
}
