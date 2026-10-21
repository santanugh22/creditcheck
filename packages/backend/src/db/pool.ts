import fs from "fs";
import path from "path";
import { Pool, QueryResult, QueryResultRow, types } from "pg";
import { env } from "../config/env";

// PostgreSQL DATE OID is 1082. Return raw "YYYY-MM-DD" string instead of Date object
// to avoid local/UTC timezone distortion across timezones.
types.setTypeParser(1082, (val: string) => val);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error(
    "⚠️ [PostgreSQL Pool] Unexpected error on idle client:",
    err.message,
  );
});

/**
 * Helper to execute parameterized SQL queries with timing in development
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Reads schema.sql and applies all tables and indexes idempotently.
 */
export async function initializeDatabase(): Promise<void> {
  const schemaPath = path.resolve(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    if (env.NODE_ENV !== "test") {
      console.log(
        "🗄️  [PostgreSQL] Database schema verified & migrated successfully.",
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ [PostgreSQL] Schema migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow standalone CLI execution via: npm run db:migrate
if (process.argv.includes("--migrate-only")) {
  initializeDatabase()
    .then(async () => {
      await pool.end();
      console.log("✅ [PostgreSQL] Standalone migration completed.");
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ [PostgreSQL] Standalone migration error:", err);
      await pool.end();
      process.exit(1);
    });
}
