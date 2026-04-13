import { db, usersTable } from "@workspace/db";
const users = await db.select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, isAdmin: usersTable.isAdmin }).from(usersTable);
console.log(JSON.stringify(users, null, 2));
