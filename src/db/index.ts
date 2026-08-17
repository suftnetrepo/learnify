import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

/**
 * Connection pool configuration.
 *
 * Serverless (Vercel, Railway):
 *   - Use max:1 to avoid exhausting connections across concurrent function invocations.
 *   - Use a pooler URL from Neon/Supabase (port 6543) for PgBouncer transaction mode.
 *
 * Long-running server (VPS, Docker):
 *   - Increase max to 10–20 depending on your DB plan's connection limit.
 *
 * Switch between modes via DATABASE_URL:
 *   - Dev:        postgresql://localhost/learnify
 *   - Prod pool:  postgresql://user:pass@host.neon.tech:6543/learnify?pgbouncer=true&connect_timeout=10
 */
const isServerless = process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT;
const maxConnections = isServerless ? 1 : 10;

const client = postgres(process.env.DATABASE_URL, {
  max:             maxConnections,
  idle_timeout:    20,   // seconds before idle connections close
  connect_timeout: 10,   // seconds to wait for a connection
  prepare:         !isServerless, // disable prepared statements for PgBouncer
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ||
       process.env.DATABASE_URL.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export type DB = typeof db;
export * from "./schema";
