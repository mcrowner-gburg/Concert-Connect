import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import {
  clearSession,
  createSession,
  deleteSession,
  getSessionId,
  hashPassword,
  verifyPassword,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";

const router: IRouter = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(2, "Username must be at least 2 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

router.get("/auth/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.user });
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, password, username, firstName, lastName } = parsed.data;

  const existing = await db.select().from(usersTable).where(
    or(eq(usersTable.email, email), eq(usersTable.username, username))
  );
  if (existing.length > 0) {
    if (existing.some(u => u.email === email)) {
      res.status(409).json({ error: "An account with that email already exists" });
    } else {
      res.status(409).json({ error: "That username is already taken" });
    }
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, username, firstName: firstName ?? null, lastName: lastName ?? null })
    .returning();

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt.toISOString(),
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.status(201).json({ user: sessionData.user, token: sid });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  // Use a constant-time check even when no user found to prevent timing attacks
  const hash = user?.passwordHash ?? "$2a$12$invalidhashfortimingprotection000000000000000000000000";
  const valid = await verifyPassword(password, hash);

  if (!user || !valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Auto-promote ADMIN_EMAIL to admin + super admin
  if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
    const updates: { isAdmin?: boolean; isSuperAdmin?: boolean } = {};
    if (!user.isAdmin) updates.isAdmin = true;
    if (!user.isSuperAdmin) updates.isSuperAdmin = true;
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
      Object.assign(user, updates);
    }
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt.toISOString(),
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ user: sessionData.user, token: sid });
});

router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

// Mobile: accepts Bearer token, just deletes the session
router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json({ success: true });
});

export default router;
