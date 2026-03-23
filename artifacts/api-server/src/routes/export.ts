import { Router, type IRouter } from "express";
import { eq, gte, lte, and, inArray, sql } from "drizzle-orm";
import { db, showsTable, venuesTable } from "@workspace/db";
import { ExportShowsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/export/shows", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ExportShowsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { city, zipCode, startDate, endDate } = params.data;

  const conditions = [];
  if (startDate) conditions.push(gte(showsTable.showDate, new Date(startDate)));
  if (endDate) conditions.push(lte(showsTable.showDate, new Date(endDate)));

  if (city || zipCode) {
    const venueConditions = [];
    if (city) venueConditions.push(sql`lower(${venuesTable.city}) = lower(${city})`);
    if (zipCode) venueConditions.push(eq(venuesTable.zipCode, zipCode));
    const matchingVenues = await db.select({ id: venuesTable.id }).from(venuesTable).where(and(...venueConditions));
    if (matchingVenues.length > 0) {
      conditions.push(inArray(showsTable.venueId, matchingVenues.map(v => v.id)));
    }
  }

  const shows = await db
    .select({ show: showsTable, venue: venuesTable })
    .from(showsTable)
    .innerJoin(venuesTable, eq(showsTable.venueId, venuesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(showsTable.showDate)
    .limit(1000);

  const headers = ["Date", "Time", "Artist/Title", "Venue", "City", "State", "Zip", "Ticket Price", "Ticket URL", "Source URL"];

  const rows = shows.map(({ show, venue }) => [
    show.showDate.toLocaleDateString("en-US"),
    show.showTime ?? "",
    show.artist ? `${show.artist} - ${show.title}` : show.title,
    venue.name,
    venue.city,
    venue.state ?? "",
    venue.zipCode ?? "",
    show.ticketPrice ?? "",
    show.ticketUrl ?? "",
    show.sourceUrl ?? "",
  ]);

  const csvRows = [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  );

  const csv = csvRows.join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=live-music-shows.csv");
  res.send(csv);
});

export default router;
