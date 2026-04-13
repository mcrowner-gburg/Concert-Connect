import { Router, type IRouter } from "express";
import { eq, ilike, ne, and, or } from "drizzle-orm";
import { db, usersTable, userPreferencesTable, friendsTable, friendRequestsTable } from "@workspace/db";
import {
  GetMeResponse,
  GetUserPreferencesResponse,
  UpdateUserPreferencesBody,
  UpdateUserPreferencesResponse,
  SearchUsersQueryParams,
  SearchUsersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetMeResponse.parse({
    id: 0,
    username: user.username ?? user.email ?? user.id,
    displayName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : null,
    profileImageUrl: user.profileImageUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/users/preferences", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, req.user.id));

  if (!prefs) {
    [prefs] = await db.insert(userPreferencesTable).values({
      userId: req.user.id,
      cities: [],
      zipCodes: [],
    }).returning();
  }

  res.json(GetUserPreferencesResponse.parse({
    id: prefs.id,
    userId: 0,
    cities: prefs.cities,
    zipCodes: prefs.zipCodes,
    updatedAt: prefs.updatedAt.toISOString(),
  }));
});

router.put("/users/preferences", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateUserPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, req.user.id));

  let prefs;
  if (existing) {
    [prefs] = await db.update(userPreferencesTable)
      .set({ cities: parsed.data.cities, zipCodes: parsed.data.zipCodes })
      .where(eq(userPreferencesTable.userId, req.user.id))
      .returning();
  } else {
    [prefs] = await db.insert(userPreferencesTable).values({
      userId: req.user.id,
      cities: parsed.data.cities,
      zipCodes: parsed.data.zipCodes,
    }).returning();
  }

  res.json(UpdateUserPreferencesResponse.parse({
    id: prefs.id,
    userId: 0,
    cities: prefs.cities,
    zipCodes: prefs.zipCodes,
    updatedAt: prefs.updatedAt.toISOString(),
  }));
});

router.get("/users/search", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SearchUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q } = parsed.data;

  const users = await db.select().from(usersTable)
    .where(and(
      ne(usersTable.id, req.user.id),
      or(
        ilike(usersTable.username, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(usersTable.firstName, `%${q}%`),
      )
    ))
    .limit(20);

  const myFriends = await db.select().from(friendsTable).where(eq(friendsTable.userId, req.user.id));
  const myRequests = await db.select().from(friendRequestsTable)
    .where(or(
      eq(friendRequestsTable.fromUserId, req.user.id),
      eq(friendRequestsTable.toUserId, req.user.id)
    ));

  const friendIds = new Set(myFriends.map(f => f.friendId));
  const pendingIds = new Set(
    myRequests.filter(r => r.status === "pending").flatMap(r => [r.fromUserId, r.toUserId])
  );

  const results = users.map(u => ({
    id: u.id,
    username: u.username ?? u.email ?? u.id,
    displayName: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : null,
    profileImageUrl: u.profileImageUrl,
    isFriend: friendIds.has(u.id),
    hasPendingRequest: pendingIds.has(u.id) && !friendIds.has(u.id),
  }));

  res.json(SearchUsersResponse.parse(results));
});

export default router;
