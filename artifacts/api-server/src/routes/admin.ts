import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable, attendanceTable, friendsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// List all users with stats
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);

  const attendanceCounts = await db
    .select({ userId: attendanceTable.userId, count: count() })
    .from(attendanceTable)
    .groupBy(attendanceTable.userId);

  const friendCounts = await db
    .select({ userId: friendsTable.userId, count: count() })
    .from(friendsTable)
    .groupBy(friendsTable.userId);

  const countMap = Object.fromEntries(attendanceCounts.map(r => [r.userId, Number(r.count)]));
  const friendMap = Object.fromEntries(friendCounts.map(r => [r.userId, Number(r.count)]));

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    profileImageUrl: u.profileImageUrl,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
    showsCount: countMap[u.id] ?? 0,
    friendsCount: friendMap[u.id] ?? 0,
  }));

  res.json(result);
});

const UpdateUserBody = z.object({
  isAdmin: z.boolean().optional(),
  username: z.string().min(2).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Update a user (toggle admin, rename, etc.)
router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ id: updated.id, email: updated.email, username: updated.username, isAdmin: updated.isAdmin });
});

// Delete a user
router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (req.user.id === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;
