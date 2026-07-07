import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Lazy: constructing a Pool with an unset connectionString doesn't throw
// (pg only connects on first query), which keeps `next build`'s page-data
// collection step from failing in environments without DATABASE_URL wired
// up yet. Runtime queries will fail loudly instead if it's really missing.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
