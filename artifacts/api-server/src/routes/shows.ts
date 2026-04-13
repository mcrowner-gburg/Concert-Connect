import { Router, type IRouter } from "express";
import { eq, gte, lte, and, inArray, sql } from "drizzle-orm";
import { db, showsTable, venuesTable, attendanceTable, userPreferencesTable, friendsTable, usersTable } from "@workspace/db";
import { syncTicketmasterToDb } from "../lib/ticketmaster";
import { z } from "zod";
import {
  ListShowsResponse,
  GetShowResponse,
  GetShowParams,
  ListShowsQueryParams,
  MarkAttendingParams,
  MarkAttendingBody,
  MarkAttendingResponse,
  RemoveAttendanceParams,
  GetShowAttendeesParams,
  GetShowAttendeesResponse,
} from "@workspace/api-zod";

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

async function buildShowWithDetails(show: typeof showsTable.$inferSelect, venue: typeof venuesTable.$inferSelect, userId?: string, friendIds?: string[]) {
  const attendees = await db
    .select({ userId: attendanceTable.userId, boughtTickets: attendanceTable.boughtTickets })
    .from(attendanceTable)
    .where(eq(attendanceTable.showId, show.id));

  const currentUserAttendance = userId ? attendees.find(a => a.userId === userId) : null;
  const currentUserAttending = !!currentUserAttendance;
  const currentUserBoughtTickets = currentUserAttendance?.boughtTickets ?? false;

  const friendAttendees = friendIds && friendIds.length > 0
    ? attendees.filter(a => friendIds.includes(a.userId))
    : [];

  let friendsAttending: Array<{ userId: number; username: string; displayName: string | null; profileImageUrl: string | null; boughtTickets: boolean }> = [];
  if (friendAttendees.length > 0) {
    const friendUsers = await db.select().from(usersTable).where(inArray(usersTable.id, friendAttendees.map(a => a.userId)));
    friendsAttending = friendAttendees.map(fa => {
      const u = friendUsers.find(u => u.id === fa.userId);
      return {
        userId: 0,
        username: u?.username ?? u?.email ?? fa.userId,
        displayName: u?.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : null,
        profileImageUrl: u?.profileImageUrl ?? null,
        boughtTickets: fa.boughtTickets,
      };
    });
  }

  return {
    id: show.id,
    venueId: show.venueId,
    title: show.title,
    artist: show.artist,
    description: show.description,
    showDate: show.showDate.toISOString(),
    doorsTime: show.doorsTime,
    showTime: show.showTime,
    ticketUrl: show.ticketUrl,
    ticketPrice: show.ticketPrice,
    imageUrl: show.imageUrl,
    sourceUrl: show.sourceUrl,
    createdAt: show.createdAt.toISOString(),
    venue: mapVenue(venue),
    attendeeCount: attendees.length,
    currentUserAttending,
    currentUserBoughtTickets,
    friendsAttending,
  };
}

router.get("/shows", async (req, res): Promise<void> => {
  const params = ListShowsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { city, zipCode, startDate, endDate, venueId } = params.data;

  let conditions = [];
  if (startDate) conditions.push(gte(showsTable.showDate, new Date(startDate)));
  if (endDate) conditions.push(lte(showsTable.showDate, new Date(endDate)));
  if (venueId) conditions.push(eq(showsTable.venueId, venueId));

  let venueFilter: string[] | null = null;

  if (city || zipCode) {
    // Auto-sync from Ticketmaster so any user can search any city/zip
    await syncTicketmasterToDb({ city, postalCode: zipCode });

    const venueConditions = [];
    if (city) venueConditions.push(sql`lower(${venuesTable.city}) = lower(${city})`);
    if (zipCode) venueConditions.push(eq(venuesTable.zipCode, zipCode));
    const matchingVenues = await db.select({ id: venuesTable.id }).from(venuesTable).where(and(...venueConditions));
    venueFilter = matchingVenues.map(v => String(v.id));
    if (venueFilter.length > 0) {
      conditions.push(inArray(showsTable.venueId, matchingVenues.map(v => v.id)));
    }
  } else if (req.isAuthenticated() && !venueId) {
    const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, req.user.id));
    if (prefs && (prefs.cities.length > 0 || prefs.zipCodes.length > 0)) {
      const prefConditions = [];
      if (prefs.cities.length > 0) {
        prefConditions.push(inArray(sql`lower(${venuesTable.city})`, prefs.cities.map(c => c.toLowerCase())));
      }
      if (prefs.zipCodes.length > 0) {
        prefConditions.push(inArray(venuesTable.zipCode, prefs.zipCodes));
      }
      const matchingVenues = await db.select({ id: venuesTable.id }).from(venuesTable).where(or(...prefConditions));
      if (matchingVenues.length > 0) {
        conditions.push(inArray(showsTable.venueId, matchingVenues.map(v => v.id)));
      }
    }
  }

  const shows = await db
    .select({ show: showsTable, venue: venuesTable })
    .from(showsTable)
    .innerJoin(venuesTable, eq(showsTable.venueId, venuesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(showsTable.showDate)
    .limit(200);

  let friendIds: string[] = [];
  if (req.isAuthenticated()) {
    const friends = await db.select({ friendId: friendsTable.friendId }).from(friendsTable).where(eq(friendsTable.userId, req.user.id));
    friendIds = friends.map(f => f.friendId);
  }

  const showsWithDetails = await Promise.all(
    shows.map(({ show, venue }) => buildShowWithDetails(show, venue, req.isAuthenticated() ? req.user.id : undefined, friendIds))
  );

  res.json(ListShowsResponse.parse(showsWithDetails));
});

function or(...conditions: ReturnType<typeof eq>[]) {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return sql`(${conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} OR ${c}`)})`;
}

router.get("/shows/:id", async (req, res): Promise<void> => {
  const params = GetShowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [result] = await db
    .select({ show: showsTable, venue: venuesTable })
    .from(showsTable)
    .innerJoin(venuesTable, eq(showsTable.venueId, venuesTable.id))
    .where(eq(showsTable.id, params.data.id));

  if (!result) {
    res.status(404).json({ error: "Show not found" });
    return;
  }

  let friendIds: string[] = [];
  if (req.isAuthenticated()) {
    const friends = await db.select({ friendId: friendsTable.friendId }).from(friendsTable).where(eq(friendsTable.userId, req.user.id));
    friendIds = friends.map(f => f.friendId);
  }

  const showWithDetails = await buildShowWithDetails(result.show, result.venue, req.isAuthenticated() ? req.user.id : undefined, friendIds);
  res.json(GetShowResponse.parse(showWithDetails));
});

router.post("/shows/:id/attend", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = MarkAttendingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = MarkAttendingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.showId, params.data.id)));

  let attendance;
  if (existing) {
    [attendance] = await db.update(attendanceTable)
      .set({ boughtTickets: parsed.data.boughtTickets })
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.showId, params.data.id)))
      .returning();
  } else {
    [attendance] = await db.insert(attendanceTable).values({
      userId: req.user.id,
      showId: params.data.id,
      boughtTickets: parsed.data.boughtTickets,
    }).returning();
  }

  res.json(MarkAttendingResponse.parse({
    id: attendance.id,
    userId: 0,
    showId: attendance.showId,
    boughtTickets: attendance.boughtTickets,
    createdAt: attendance.createdAt.toISOString(),
  }));
});

router.delete("/shows/:id/attend", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = RemoveAttendanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(attendanceTable)
    .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.showId, params.data.id)));

  res.sendStatus(204);
});

const CreateShowBody = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string().optional(),
  venueId: z.number().int().positive("Please select a venue"),
  showDate: z.string().min(1, "Date is required"),
  showTime: z.string().optional(),
  doorsTime: z.string().optional(),
  description: z.string().optional(),
  ticketUrl: z.string().optional(),
  ticketPrice: z.string().optional(),
  imageUrl: z.string().optional(),
});

router.post("/shows", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateShowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { venueId, showDate, ticketUrl, imageUrl, ...rest } = parsed.data;

  const [venue] = await db.select().from(venuesTable).where(eq(venuesTable.id, venueId));
  if (!venue) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const [show] = await db.insert(showsTable).values({
    venueId,
    showDate: new Date(showDate),
    ticketUrl: ticketUrl || null,
    imageUrl: imageUrl || null,
    sourceUrl: null,
    ...rest,
  }).returning();

  await db.insert(attendanceTable).values({
    userId: req.user.id,
    showId: show.id,
    boughtTickets: false,
  }).onConflictDoNothing();

  const showWithDetails = await buildShowWithDetails(show, venue, req.user.id, []);
  res.status(201).json(showWithDetails);
});

router.get("/shows/:id/attendees", async (req, res): Promise<void> => {
  const params = GetShowAttendeesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const attendees = await db
    .select({ attendance: attendanceTable, user: usersTable })
    .from(attendanceTable)
    .innerJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .where(eq(attendanceTable.showId, params.data.id));

  res.json(GetShowAttendeesResponse.parse(attendees.map(({ attendance, user }) => ({
    userId: 0,
    username: user.username ?? user.email ?? user.id,
    displayName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : null,
    profileImageUrl: user.profileImageUrl,
    boughtTickets: attendance.boughtTickets,
  }))));
});

export default router;
