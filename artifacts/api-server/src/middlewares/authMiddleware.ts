import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { clearSession, getSession, getSessionId, updateSession } from "../lib/auth";

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = session.user;

  // Re-hydrate stale sessions that pre-date the isSuperAdmin field
  if ((req.user as any).isSuperAdmin === undefined) {
    const [dbUser] = await db
      .select({ isAdmin: usersTable.isAdmin, isSuperAdmin: usersTable.isSuperAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));
    if (dbUser) {
      req.user.isAdmin = dbUser.isAdmin;
      req.user.isSuperAdmin = dbUser.isSuperAdmin;
      // Write the refreshed fields back into the session so this only runs once
      await updateSession(sid, { ...session, user: req.user });
    } else {
      req.user.isSuperAdmin = false;
    }
  }

  next();
}
