import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Captured before .env.local loads, so an inline DATABASE_URL=… can be labelled as such
const inlineUrl = process.env.DATABASE_URL;

dotenv.config({ path: ".env.local" });

// DRIZZLE_TARGET=live (set by the db:*:live scripts) uses DATABASE_URL_LIVE from
// .env.local, so the live URL never has to be typed. Otherwise DATABASE_URL is
// used — an inline DATABASE_URL=… still wins over .env.local.
const target = process.env.DRIZZLE_TARGET === "live" ? "live" : inlineUrl ? "inline" : "dev";
const envVar = target === "live" ? "DATABASE_URL_LIVE" : "DATABASE_URL";
const dbUrl  = process.env[envVar];

if (!dbUrl) {
  throw new Error(`${envVar} is not set in .env.local`);
}

// Always show which database is about to be touched, before any changes are made
const host = dbUrl.match(/@([^/?]+)/)?.[1] ?? "unknown";
console.log(`\n  Database: ${target.toUpperCase()} → ${host}\n`);

export default {
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
