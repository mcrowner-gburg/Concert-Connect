import { Router, type IRouter } from "express";
import { eq, or, and, inArray, gte } from "drizzle-orm";
import { db, friendsTable, friendRequestsTable, usersTable, attendanceTable, showsTable, venuesTable } from "@workspace/db";
import {
  ListFriendsResponse,
  ListFriendRequestsResponse,
  SendFriendRequestBody,
  AcceptFriendRequestParams,
  AcceptFriendRequestResponse,
  DeclineFriendRequestParams,
  DeclineFriendRequestResponse,
  RemoveFriendParams,
  GetFriendsActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/friends", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const myFriends = await db.select().from(friendsTable).where(eq(friendsTable.userId, req.user.id));

  if (myFriends.length === 0) {
    res.json(ListFriendsResponse.parse([]));
    return;
  }

  const friendIds = myFriends.map(f => f.friendId);

  const friendUsers = await db.select().from(usersTable)
    .where(inArray(usersTable.id, friendIds));

  const now = new Date();
  const upcomingAttendance = await db
    .select({ userId: attendanceTable.userId })
    .from(attendanceTable)
    .innerJoin(showsTable, eq(attendanceTable.showId, showsTable.id))
    .where(and(
      inArray(attendanceTable.userId, friendIds),
      gte(showsTable.showDate, now)
    ));

  const upcomingCountByUser: Record<string, number> = {};
  for (const a of upcomingAttendance) {
    upcomingCountByUser[a.userId] = (upcomingCountByUser[a.userId] ?? 0) + 1;
  }

  const result = myFriends.map(f => {
    const u = friendUsers.find(u => u.id === f.friendId);
    return {
      friendshipId: f.id,
      userId: 0,
      username: u?.username ?? u?.email ?? f.friendId,
      displayName: u?.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : null,
      profileImageUrl: u?.profileImageUrl ?? null,
      upcomingShowsCount: upcomingCountByUser[f.friendId] ?? 0,
    };
  });

  res.json(ListFriendsResponse.parse(result));
});

router.get("/friends/requests", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requests = await db.select().from(friendRequestsTable)
    .where(and(
      or(
        eq(friendRequestsTable.fromUserId, req.user.id),
        eq(friendRequestsTable.toUserId, req.user.id)
      ),
      eq(friendRequestsTable.status, "pending")
    ));

  const userIds = [...new Set(requests.flatMap(r => [r.fromUserId, r.toUserId]))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const result = requests.map(r => {
    const fromUser = users.find(u => u.id === r.fromUserId);
    const toUser = users.find(u => u.id === r.toUserId);
    return {
      id: r.id,
      fromUserId: 0,
      toUserId: 0,
      fromUsername: fromUser?.username ?? fromUser?.email ?? r.fromUserId,
      toUsername: toUser?.username ?? toUser?.email ?? r.toUserId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  });

  res.json(ListFriendRequestsResponse.parse(result));
});

router.post("/friends/requests", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SendFriendRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const toUser = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.toUserId)).limit(1);
  if (toUser.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const toUserId = toUser[0].id;

  const existingRequests = await db.select().from(friendRequestsTable)
    .where(or(
      and(eq(friendRequestsTable.fromUserId, req.user.id), eq(friendRequestsTable.toUserId, toUserId)),
      and(eq(friendRequestsTable.fromUserId, toUserId), eq(friendRequestsTable.toUserId, req.user.id))
    ));

  for (const r of existingRequests) {
    if (r.status === "pending") {
      res.status(400).json({ error: "Friend request already exists" });
      return;
    }
    // Clean up declined/accepted stale records so a fresh request can be sent
    await db.delete(friendRequestsTable).where(eq(friendRequestsTable.id, r.id));
  }

  const [request] = await db.insert(friendRequestsTable).values({
    fromUserId: req.user.id,
    toUserId: toUserId,
    status: "pending",
  }).returning();

  const fromUser = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);

  res.status(201).json({
    id: request.id,
    fromUserId: 0,
    toUserId: 0,
    fromUsername: fromUser[0]?.username ?? fromUser[0]?.email ?? req.user.id,
    toUsername: toUser[0]?.username ?? toUser[0]?.email ?? toUserId,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
  });
});

router.post("/friends/requests/:id/accept", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AcceptFriendRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [request] = await db.select().from(friendRequestsTable)
    .where(and(eq(friendRequestsTable.id, params.data.id), eq(friendRequestsTable.toUserId, req.user.id)));

  if (!request) {
    res.status(404).json({ error: "Friend request not found" });
    return;
  }

  await db.update(friendRequestsTable).set({ status: "accepted" }).where(eq(friendRequestsTable.id, request.id));

  await db.insert(friendsTable).values([
    { userId: request.fromUserId, friendId: request.toUserId },
    { userId: request.toUserId, friendId: request.fromUserId },
  ]).onConflictDoNothing();

  res.json(AcceptFriendRequestResponse.parse({ success: true }));
});

router.post("/friends/requests/:id/decline", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeclineFriendRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.update(friendRequestsTable).set({ status: "declined" }).where(
    and(eq(friendRequestsTable.id, params.data.id), eq(friendRequestsTable.toUserId, req.user.id))
  );

  res.json(DeclineFriendRequestResponse.parse({ success: true }));
});

router.delete("/friends/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = RemoveFriendParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [friendship] = await db.select().from(friendsTable)
    .where(and(eq(friendsTable.id, params.data.id), eq(friendsTable.userId, req.user.id)));

  if (!friendship) {
    res.status(404).json({ error: "Friendship not found" });
    return;
  }

  await db.delete(friendsTable).where(or(
    and(eq(friendsTable.userId, req.user.id), eq(friendsTable.friendId, friendship.friendId)),
    and(eq(friendsTable.userId, friendship.friendId), eq(friendsTable.friendId, req.user.id))
  ));

  res.sendStatus(204);
});

router.get("/friends/activity", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const myFriends = await db.select().from(friendsTable).where(eq(friendsTable.userId, req.user.id));

  if (myFriends.length === 0) {
    res.json(GetFriendsActivityResponse.parse([]));
    return;
  }

  const friendIds = myFriends.map(f => f.friendId);
  const now = new Date();

  const attendance = await db
    .select({ attendance: attendanceTable, show: showsTable, venue: venuesTable })
    .from(attendanceTable)
    .innerJoin(showsTable, eq(attendanceTable.showId, showsTable.id))
    .innerJoin(venuesTable, eq(showsTable.venueId, venuesTable.id))
    .where(and(
      inArray(attendanceTable.userId, friendIds),
      gte(showsTable.showDate, now)
    ))
    .orderBy(showsTable.showDate);

  const friendUsers = friendIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, friendIds))
    : [];

  const showMap = new Map<number, { show: typeof showsTable.$inferSelect; venue: typeof venuesTable.$inferSelect; friends: Array<typeof attendanceTable.$inferSelect & { user: typeof usersTable.$inferSelect | undefined }> }>();

  for (const row of attendance) {
    if (!showMap.has(row.show.id)) {
      showMap.set(row.show.id, { show: row.show, venue: row.venue, friends: [] });
    }
    const entry = showMap.get(row.show.id)!;
    entry.friends.push({ ...row.attendance, user: friendUsers.find(u => u.id === row.attendance.userId) });
  }

  // Fetch current user's own attendance for these shows
  const showIds = Array.from(showMap.keys());
  const myAttendance = showIds.length > 0
    ? await db.select().from(attendanceTable).where(
        and(eq(attendanceTable.userId, req.user.id), inArray(attendanceTable.showId, showIds))
      )
    : [];
  const myAttendanceByShow = new Map(myAttendance.map(a => [a.showId, a]));

  const result = Array.from(showMap.values()).map(({ show, venue, friends }) => {
    const myA = myAttendanceByShow.get(show.id);
    return {
      showId: show.id,
      showTitle: show.title,
      showDate: show.showDate.toISOString(),
      venueName: venue.name,
      venueCity: venue.city,
      ticketUrl: show.ticketUrl,
      currentUserAttending: myA != null && !myA.interested,
      currentUserBoughtTickets: myA?.boughtTickets ?? false,
      currentUserInterested: myA?.interested ?? false,
      friends: friends.map(f => ({
        userId: 0,
        username: f.user?.username ?? f.user?.email ?? f.userId,
        displayName: f.user?.firstName ? `${f.user.firstName} ${f.user.lastName ?? ""}`.trim() : null,
        profileImageUrl: f.user?.profileImageUrl ?? null,
        boughtTickets: f.boughtTickets,
      })),
    };
  });

  res.json(GetFriendsActivityResponse.parse(result));
});

export default router;
