import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

const isProduction = env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, {
  schema,
  logger: env.NODE_ENV === "development",
});

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
