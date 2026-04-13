import { db, friendsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const MATT_ID = "86f5424f-ac6f-4516-bac6-0e8f8a8b092a";

const friends = await db.select().from(friendsTable).where(eq(friendsTable.userId, MATT_ID));
console.log("Friends for matt:", JSON.stringify(friends, null, 2));

const allFriends = await db.select().from(friendsTable);
console.log("Total friendship rows:", allFriends.length);
