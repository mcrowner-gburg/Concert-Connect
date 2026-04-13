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
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import multer from "multer";

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

const UpdateProfileBody = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  username: z.string().min(2).optional(),
  profileImageUrl: z.string().url().optional().nullable(),
});

router.patch("/users/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.firstName !== undefined) updates.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) updates.lastName = parsed.data.lastName;
  if (parsed.data.username !== undefined) updates.username = parsed.data.username;
  if (parsed.data.profileImageUrl !== undefined) updates.profileImageUrl = parsed.data.profileImageUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: 0,
    username: updated.username ?? updated.email ?? updated.id,
    displayName: updated.firstName ? `${updated.firstName} ${updated.lastName ?? ""}`.trim() : null,
    profileImageUrl: updated.profileImageUrl,
    isAdmin: updated.isAdmin,
    createdAt: updated.createdAt.toISOString(),
  });
});

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/users/avatar", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const s3 = getR2Client();
  if (!s3) {
    res.status(503).json({ error: "File uploads are not configured" });
    return;
  }

  const bucket = process.env.R2_BUCKET_NAME ?? "concert-connect";
  const ext = req.file.mimetype.split("/")[1] ?? "jpg";
  const key = `avatars/${req.user.id}/${crypto.randomBytes(8).toString("hex")}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  }));

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : `https://pub-placeholder.r2.dev/${key}`;

  // Save to user profile
  const [updated] = await db.update(usersTable)
    .set({ profileImageUrl: publicUrl })
    .where(eq(usersTable.id, req.user.id))
    .returning();

  res.json({ url: publicUrl, user: {
    id: 0,
    username: updated.username ?? updated.email ?? updated.id,
    profileImageUrl: updated.profileImageUrl,
    isAdmin: updated.isAdmin,
    createdAt: updated.createdAt.toISOString(),
  }});
});

export default router;
