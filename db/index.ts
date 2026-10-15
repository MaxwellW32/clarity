import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per process. In development the module re-evaluates on every edit, so the pool is kept on
// globalThis rather than leaking a new set of connections each time.
const globalForDb = globalThis as unknown as { clarityPool?: Pool };

const pool =
  globalForDb.clarityPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.clarityPool = pool;

export const db = drizzle(pool, { schema });

export type Db = typeof db;
/** The handle a transaction callback receives — DAL helpers accept either. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
