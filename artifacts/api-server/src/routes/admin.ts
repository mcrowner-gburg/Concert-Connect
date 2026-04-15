import { Router, type IRouter } from "express";
import { eq, sql, count, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, usersTable, attendanceTable, friendsTable, showsTable, venuesTable } from "@workspace/db";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user.isSuperAdmin) {
    res.status(403).json({ error: "Forbidden: super admin only" });
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
    isSuperAdmin: u.isSuperAdmin,
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

// Update a user — toggling isAdmin requires super admin
router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  if (parsed.data.isAdmin !== undefined && !req.user.isSuperAdmin) {
    res.status(403).json({ error: "Only super admins can change admin status" });
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

  res.json({ id: updated.id, email: updated.email, username: updated.username, isAdmin: updated.isAdmin, isSuperAdmin: updated.isSuperAdmin });
});

// Delete a user
router.delete("/admin/users/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  if (req.user.id === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

// ─── Bulk Show Import ─────────────────────────────────────────────────────────

function normalizeVenueName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchVenue(rawName: string, venues: { id: number; name: string; city: string }[]) {
  const n = normalizeVenueName(rawName);
  if (!n) return null;

  const exact = venues.find(v => normalizeVenueName(v.name) === n);
  if (exact) return exact;

  const startsWith = venues.find(v => {
    const vn = normalizeVenueName(v.name);
    return n.startsWith(vn) || vn.startsWith(n);
  });
  if (startsWith) return startsWith;

  const contains = venues.find(v => {
    const vn = normalizeVenueName(v.name);
    return n.includes(vn) || vn.includes(n);
  });
  if (contains) return contains;

  const words = n.split(" ").filter(w => w.length > 2);
  let best: { venue: typeof venues[0]; score: number } | null = null;
  for (const v of venues) {
    const vWords = normalizeVenueName(v.name).split(" ").filter(w => w.length > 2);
    const score = words.filter(w => vWords.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { venue: v, score };
  }
  return best?.venue ?? null;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  // Strip day-range suffix like "13-14" → keep "13"
  const cleaned = raw.replace(/(\d+)-\d+$/, "$1").trim();
  const parts = cleaned.split("/");
  if (parts.length < 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year += 2000;
  return new Date(year, month - 1, day);
}

function parseFileToRows(buffer: Buffer): string[][] {
  // Handle UTF-16 LE BOM (common Excel text export)
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    const text = buffer.slice(2).toString("utf16le");
    return text
      .split(/\r\n|\r|\n/)
      .map(line => line.split("\t").map(c => c.trim()))
      .filter(row => row.some(c => c.length > 0));
  }

  // Try xlsx for .xlsx / .xls / .csv
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]).map(
      row => (row as unknown[]).map(c => String(c ?? "").trim()),
    );
  } catch {
    // Fallback: plain UTF-8 TSV/CSV
    const text = buffer.toString("utf8");
    const delimiter = text.includes("\t") ? "\t" : ",";
    return text
      .split(/\r\n|\r|\n/)
      .map(line => line.split(delimiter).map(c => c.trim()))
      .filter(row => row.some(c => c.length > 0));
  }
}

// Preview: parse file, match venues, flag duplicates — no DB writes
router.post("/admin/shows/import/preview", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const rows = parseFileToRows(req.file.buffer);
  if (rows.length < 2) {
    res.status(400).json({ error: "File has no data rows" });
    return;
  }

  // Find header row (first row containing "date" and "show" or "venue")
  let headerIdx = rows.findIndex(row =>
    row.some(c => c.toLowerCase() === "date") && row.some(c => c.toLowerCase() === "venue"),
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
  const col = (name: string) => headers.findIndex(h => h === name);

  const dateCol = col("date");
  const showCol = col("show");
  const openerCol = col("opener");
  const venueCol = col("venue");
  const notesCol = col("notes");

  if (dateCol === -1 || showCol === -1 || venueCol === -1) {
    res.status(400).json({ error: "Could not find required columns (date, show, venue)" });
    return;
  }

  const [allVenues, existingShows] = await Promise.all([
    db.select({ id: venuesTable.id, name: venuesTable.name, city: venuesTable.city }).from(venuesTable),
    db.select({ showDate: showsTable.showDate, artist: showsTable.artist, title: showsTable.title, venueId: showsTable.venueId }).from(showsTable),
  ]);

  const dataRows = rows.slice(headerIdx + 1);
  const preview = dataRows.map((row, i) => {
    const rawDate = row[dateCol] ?? "";
    const artist = (row[showCol] ?? "").trim();
    const rawVenue = (row[venueCol] ?? "").trim();
    const opener = openerCol !== -1 ? (row[openerCol] ?? "").trim() : "";
    const notes = notesCol !== -1 ? (row[notesCol] ?? "").trim() : "";

    if (!rawDate || !artist || !rawVenue) {
      return null; // skip blank/incomplete rows
    }

    const showDate = parseDate(rawDate);
    if (!showDate) return null;

    const matchedVenue = matchVenue(rawVenue, allVenues);

    const isDuplicate = matchedVenue
      ? existingShows.some(s => {
          if (s.venueId !== matchedVenue.id) return false;
          const sDate = new Date(s.showDate);
          if (sDate.toDateString() !== showDate.toDateString()) return false;
          const sArtist = (s.artist ?? s.title).toLowerCase().trim();
          return sArtist === artist.toLowerCase().trim();
        })
      : false;

    const descParts = [opener ? `Opener: ${opener}` : "", notes].filter(Boolean);

    return {
      rowIndex: headerIdx + 1 + i,
      artist,
      showDate: showDate.toISOString().split("T")[0],
      rawVenue,
      matchedVenue: matchedVenue ? { id: matchedVenue.id, name: matchedVenue.name, city: matchedVenue.city } : null,
      description: descParts.length > 0 ? descParts.join(" | ") : null,
      isDuplicate,
      willImport: !!matchedVenue && !isDuplicate,
    };
  }).filter(Boolean);

  const willImport = preview.filter(r => r!.willImport).length;
  const unmatched = preview.filter(r => !r!.matchedVenue).length;
  const duplicates = preview.filter(r => r!.isDuplicate).length;

  res.json({
    rows: preview,
    summary: { total: preview.length, willImport, unmatched, duplicates },
  });
});

const ConfirmImportBody = z.object({
  shows: z.array(z.object({
    artist: z.string(),
    showDate: z.string(),
    venueId: z.number().int(),
    description: z.string().nullable(),
  })),
});

// Confirm: insert the approved shows
router.post("/admin/shows/import/confirm", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ConfirmImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { shows } = parsed.data;
  if (shows.length === 0) {
    res.json({ imported: 0 });
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const show of shows) {
    const showDate = new Date(show.showDate);
    if (isNaN(showDate.getTime())) { skipped++; continue; }

    // Final duplicate check before insert
    const [dupe] = await db
      .select({ id: showsTable.id })
      .from(showsTable)
      .where(
        and(
          eq(showsTable.venueId, show.venueId),
          gte(showsTable.showDate, new Date(showDate.getFullYear(), showDate.getMonth(), showDate.getDate())),
          lte(showsTable.showDate, new Date(showDate.getFullYear(), showDate.getMonth(), showDate.getDate(), 23, 59, 59)),
        ),
      )
      .limit(1);

    if (dupe) { skipped++; continue; }

    await db.insert(showsTable).values({
      venueId: show.venueId,
      title: show.artist,
      artist: show.artist,
      description: show.description ?? null,
      showDate,
      sourceUrl: null,
      ticketUrl: null,
      imageUrl: null,
    });
    imported++;
  }

  res.json({ imported, skipped });
});

export default router;
