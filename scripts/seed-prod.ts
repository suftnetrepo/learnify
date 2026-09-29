/**
 * Production seed — creates the admin, tutor and student test accounts.
 *
 *   SEED_PASSWORD='…' DATABASE_URL='…' yarn seed:prod
 *
 * Deliberately does not load .env.local, so it can never fall back to the
 * dev database. The password comes from the environment because this repo
 * is public. Existing accounts are left untouched, so it is safe to re-run.
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { users, type UserRole } from "../src/db/schema";

const accounts: { email: string; name: string; role: UserRole }[] = [
  { email: "admin@edquis.com",   name: "Edquis Admin",  role: "admin"   },
  { email: "tutor@edquis.com",   name: "Demo Tutor",    role: "tutor"   },
  { email: "student@edquis.com", name: "Demo Student",  role: "student" },
];

async function seedProd() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error("SEED_PASSWORD must be set (at least 8 characters)");
  }

  console.log(`Seeding production test accounts on ${new URL(process.env.DATABASE_URL!).host}...`);

  const passwordHash = await bcrypt.hash(seedPassword, 12);

  for (const account of accounts) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email))
      .limit(1);

    if (existing) {
      console.log(`  Already exists: ${account.email}`);
      continue;
    }

    await db.insert(users).values({
      ...account,
      passwordHash,
      status:        "active",
      emailVerified: true,
    });
    console.log(`  Created: ${account.email} (${account.role})`);
  }

  console.log("Done.");
  process.exit(0);
}

seedProd().catch((e) => {
  console.error(e);
  process.exit(1);
});
