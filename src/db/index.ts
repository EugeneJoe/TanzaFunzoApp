import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Next.js loads .env.local itself before any app code runs, so this is a
// no-op there (dotenv doesn't override already-set vars). It matters for
// standalone scripts run via `tsx` (db/seed.ts, one-off checks), which have
// no such preloading — without it, a script's own `dotenv.config()` call
// would run too late: ES module imports (this one included) are all
// resolved before any of the *importing* script's own statements execute,
// regardless of where those statements are textually positioned.
config({ path: ".env.local" });

// Lazy: constructing a Pool with an unset connectionString doesn't throw
// (pg only connects on first query), which keeps `next build`'s page-data
// collection step from failing in environments without DATABASE_URL wired
// up yet. Runtime queries will fail loudly instead if it's really missing.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
