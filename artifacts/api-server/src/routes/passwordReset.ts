import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { Resend } from "resend";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function getAppUrl() {
  return process.env.APP_URL ?? "https://concert-connect-production.up.railway.app";
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? "Concert Connect <onboarding@resend.dev>";
}

router.post("/auth/forgot-password", async (req: Request, res: Response): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const { email } = parsed.data;

  // Always respond 200 to avoid leaking whether the email exists
  res.json({ success: true, message: "If an account exists, a reset link has been sent." });

  // Fire and forget — don't await to keep response fast
  (async () => {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (!user) return;

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
      const displayName = user.firstName ?? user.email ?? "there";

      const resend = getResend();
      await resend.emails.send({
        from: getFromEmail(),
        to: email,
        subject: "Reset your Concert Connect password",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #ff007f; font-size: 24px; letter-spacing: 0.1em; text-transform: uppercase;">Concert Connect</h2>
            <p>Hi ${displayName},</p>
            <p>Someone requested a password reset for your account. If that was you, click the link below. The link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #ff007f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Reset Password</a>
            <p style="color: #888; font-size: 14px;">Or paste this URL into your browser:<br>${resetUrl}</p>
            <p style="color: #888; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send password reset email:", err);
    }
  })();
});

router.post("/auth/reset-password", async (req: Request, res: Response): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { token, password } = parsed.data;

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        gt(passwordResetTokensTable.expiresAt, new Date()),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  if (!resetToken) {
    res.status(400).json({ error: "This reset link is invalid or has expired." });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, resetToken.userId));

  await db.update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  res.json({ success: true });
});

export default router;
