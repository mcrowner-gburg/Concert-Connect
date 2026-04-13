/**
 * Seed script: creates 5 test users, marks Harrisburg shows for them,
 * and friends them all with the admin account.
 *
 * Run: DATABASE_URL=... ADMIN_EMAIL=... npx tsx scripts/seed-test-users.ts
 */
import { db, usersTable, showsTable, venuesTable, attendanceTable, friendsTable, friendRequestsTable } from "@workspace/db";
import { eq, sql, and, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL) throw new Error("ADMIN_EMAIL is required");

const TEST_USERS = [
  { email: "jenna.hayes@example.com", firstName: "Jenna", lastName: "Hayes", username: "jennahayes" },
  { email: "marcus.reeves@example.com", firstName: "Marcus", lastName: "Reeves", username: "marcusreeves" },
  { email: "priya.nair@example.com", firstName: "Priya", lastName: "Nair", username: "priyanair" },
  { email: "derek.sol@example.com", firstName: "Derek", lastName: "Sol", username: "dereksol" },
  { email: "camille.fox@example.com", firstName: "Camille", lastName: "Fox", username: "camillefox" },
];

async function main() {
  console.log("🔍 Finding admin user:", ADMIN_EMAIL);
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL!));
  if (!admin) throw new Error(`Admin user not found for email: ${ADMIN_EMAIL}`);
  console.log("✓ Admin:", admin.username ?? admin.email, `(${admin.id})`);

  // Find Harrisburg shows
  console.log("\n🎵 Finding Harrisburg shows...");
  const harrisburgShows = await db
    .select({ show: showsTable, venue: venuesTable })
    .from(showsTable)
    .innerJoin(venuesTable, eq(showsTable.venueId, venuesTable.id))
    .where(sql`lower(${venuesTable.city}) LIKE '%harrisburg%'`)
    .orderBy(showsTable.showDate)
    .limit(10);

  if (harrisburgShows.length < 5) {
    console.error(`Only found ${harrisburgShows.length} Harrisburg shows. Search for Harrisburg on the site first to populate shows.`);
    process.exit(1);
  }

  console.log(`✓ Found ${harrisburgShows.length} shows. Using first 5.`);
  const shows = harrisburgShows.slice(0, 5);
  shows.forEach((s, i) => console.log(`  ${i+1}. ${s.show.title} @ ${s.venue.name}`));

  const passwordHash = await bcrypt.hash("TestPass123!", 12);

  for (let i = 0; i < TEST_USERS.length; i++) {
    const userData = TEST_USERS[i];
    console.log(`\n👤 Creating user: ${userData.username}`);

    // Upsert user (skip if exists)
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, userData.email));
    if (!user) {
      [user] = await db.insert(usersTable).values({
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
      }).returning();
      console.log("  ✓ Created");
    } else {
      console.log("  ↩ Already exists, updating username");
      [user] = await db.update(usersTable)
        .set({ username: userData.username, firstName: userData.firstName, lastName: userData.lastName })
        .where(eq(usersTable.id, user.id))
        .returning();
    }

    // Each user attends a different combination of 5 shows (rotating)
    const userShows = shows.map((_, j) => shows[(i + j) % shows.length]);
    for (const { show } of userShows) {
      await db.insert(attendanceTable).values({
        userId: user.id,
        showId: show.id,
        boughtTickets: Math.random() > 0.5,
      }).onConflictDoNothing();
    }
    console.log(`  ✓ Marked attending ${userShows.length} shows`);

    // Create mutual friendship with admin
    const alreadyFriends = await db.select().from(friendsTable)
      .where(and(eq(friendsTable.userId, admin.id), eq(friendsTable.friendId, user.id)));

    if (alreadyFriends.length === 0) {
      // Accept any pending request or just insert friendship directly
      await db.insert(friendsTable).values([
        { userId: admin.id, friendId: user.id },
        { userId: user.id, friendId: admin.id },
      ]).onConflictDoNothing();

      // Mark any pending requests as accepted
      await db.update(friendRequestsTable).set({ status: "accepted" }).where(
        or(
          and(eq(friendRequestsTable.fromUserId, admin.id), eq(friendRequestsTable.toUserId, user.id)),
          and(eq(friendRequestsTable.fromUserId, user.id), eq(friendRequestsTable.toUserId, admin.id)),
        )
      );
      console.log("  ✓ Friended with admin");
    } else {
      console.log("  ↩ Already friends with admin");
    }
  }

  // Promote admin
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.email, ADMIN_EMAIL!));
  console.log(`\n✅ Promoted ${ADMIN_EMAIL} to admin`);

  console.log("\n🎉 Done! Test users created:");
  TEST_USERS.forEach(u => console.log(`  ${u.email} / TestPass123!`));
}

main().catch(e => { console.error(e); process.exit(1); });
