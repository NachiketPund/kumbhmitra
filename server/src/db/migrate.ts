import fs from "node:fs";
import path from "node:path";
import { db } from "./connection.js";

// Reliable cross-environment path: find the migrations folder by searching
// from process.cwd() for the src/db/migrations directory.
// When running "npm run migrate" from server/, cwd = server/
function findMigrationsDir(): string {
  const candidates = [
    path.join(process.cwd(), "src", "db", "migrations"),
    path.join(process.cwd(), "db", "migrations"),
    path.join(process.cwd(), "migrations"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // Default fallback — will produce a clear error later
  return candidates[0];
}

const MIGRATIONS_DIR = findMigrationsDir();

interface MigrationRow {
  filename: string;
  applied_at: string;
}

async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(): Promise<Set<string>> {
  const result = await db.query<MigrationRow>(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function runMigrations(): Promise<void> {
  console.log("[MIGRATE] Connecting to database…");
  console.log("[MIGRATE] Migrations dir:", MIGRATIONS_DIR);

  const health = await db.checkConnection();
  if (!health.connected) {
    console.error("[MIGRATE] Database not reachable:", health.error);
    process.exit(1);
  }
  console.log(`[MIGRATE] Connected (${health.provider}, ${health.latencyMs}ms)`);

  await ensureMigrationsTable();
  const applied = await getApplied();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error("[MIGRATE] Migrations directory not found:", MIGRATIONS_DIR);
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[MIGRATE] No migration files found in:", MIGRATIONS_DIR);
    await db.close();
    return;
  }

  console.log(`[MIGRATE] Found ${files.length} file(s):`, files.join(", "));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[MIGRATE] skip  ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    console.log(`[MIGRATE] apply ${file} (${sql.length} bytes)`);

    try {
      // runRaw uses a checked-out pg client with the simple query protocol,
      // which correctly handles multi-statement SQL (BEGIN…COMMIT blocks).
      await db.runRaw(sql);

      // Record the migration as applied (idempotent on conflict)
      await db.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
        [file]
      );
      ran++;
      console.log(`[MIGRATE] done  ${file}`);
    } catch (err: any) {
      console.error(`[MIGRATE] FAILED ${file}:`, err.message);
      if (err.detail) console.error(`         detail:`, err.detail);
      if (err.hint)   console.error(`         hint:  `, err.hint);
      if (err.where)  console.error(`         where: `, err.where);
      await db.close();
      process.exit(1);
    }
  }

  console.log(`[MIGRATE] Done. ${ran} migration(s) applied.`);
  await db.close();
}

runMigrations().catch((err) => {
  console.error("[MIGRATE] Unexpected error:", err);
  process.exit(1);
});
