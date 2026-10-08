/**
 * Schema verification script — queries Supabase and confirms all expected
 * tables and columns exist. Run after migrations.
 *
 * Usage: tsx src/db/verify-schema.ts
 */
import { db } from "./connection.js";

interface TableColRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface IndexRow {
  tablename: string;
  indexname: string;
}

interface MigrationRow {
  filename: string;
  applied_at: string;
}

// Expected schema contract
const EXPECTED: Record<string, string[]> = {
  users: [
    "id", "auth_id", "display_name", "phone", "email",
    "language", "session_token", "is_active", "created_at", "updated_at",
  ],
  places: [
    "id", "name", "category", "description", "address",
    "latitude", "longitude", "is_active", "created_at", "updated_at",
  ],
  emergency_services: [
    "id", "name", "category", "phone", "address",
    "latitude", "longitude", "verified", "is_active", "created_at", "updated_at",
  ],
  lost_found: [
    "id", "user_id", "type", "title", "description", "category",
    "location", "latitude", "longitude", "image_url", "status",
    "created_at", "updated_at",
  ],
  crowd_updates: [
    "id", "place_id", "density", "message", "language",
    "is_active", "expires_at", "created_at", "updated_at",
  ],
  events: [
    "id", "place_id", "title", "description", "category",
    "language", "starts_at", "ends_at", "is_active", "created_at", "updated_at",
  ],
  announcements: [
    "id", "place_id", "title", "body", "language",
    "priority", "active", "starts_at", "ends_at", "created_at", "updated_at",
  ],
};

async function verify(): Promise<void> {
  console.log("\n===  KumbhMitra Schema Verification  ===\n");

  const health = await db.checkConnection();
  if (!health.connected) {
    console.error("❌  Cannot connect to database:", health.error);
    process.exit(1);
  }
  console.log(`✅  Connected  (${health.provider}, ${health.latencyMs}ms)\n`);

  // Fetch all columns for our tables
  const colResult = await db.query<TableColRow>(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
    ORDER BY table_name, ordinal_position
  `, [Object.keys(EXPECTED)]);

  // Group by table
  const actual: Record<string, Set<string>> = {};
  for (const row of colResult.rows) {
    if (!actual[row.table_name]) actual[row.table_name] = new Set();
    actual[row.table_name].add(row.column_name);
  }

  let allPassed = true;

  for (const [table, columns] of Object.entries(EXPECTED)) {
    const found = actual[table];
    if (!found) {
      console.error(`❌  Table MISSING: ${table}`);
      allPassed = false;
      continue;
    }

    const missing = columns.filter((c) => !found.has(c));
    if (missing.length > 0) {
      console.error(`⚠️   Table ${table}: missing columns → ${missing.join(", ")}`);
      allPassed = false;
    } else {
      console.log(`✅  ${table.padEnd(22)} (${found.size} columns)`);
    }
  }

  // Show applied migrations
  console.log("\n--- Applied Migrations ---");
  try {
    const migs = await db.query<MigrationRow>(
      "SELECT filename, applied_at FROM schema_migrations ORDER BY filename"
    );
    if (migs.rows.length === 0) {
      console.log("   (none recorded)");
    } else {
      for (const m of migs.rows) {
        console.log(`   ${m.filename}  →  ${new Date(m.applied_at).toISOString()}`);
      }
    }
  } catch {
    console.log("   schema_migrations table not found");
  }

  // Show indexes
  console.log("\n--- Indexes ---");
  const idxResult = await db.query<IndexRow>(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = ANY($1)
    ORDER BY tablename, indexname
  `, [Object.keys(EXPECTED)]);

  const tableIndexMap: Record<string, string[]> = {};
  for (const row of idxResult.rows) {
    if (!tableIndexMap[row.tablename]) tableIndexMap[row.tablename] = [];
    tableIndexMap[row.tablename].push(row.indexname);
  }
  for (const [tbl, idxs] of Object.entries(tableIndexMap)) {
    console.log(`   ${tbl.padEnd(22)} ${idxs.join(", ")}`);
  }

  console.log("\n" + (allPassed ? "✅  All tables verified." : "❌  Some tables have issues — check output above."));
  await db.close();
  process.exit(allPassed ? 0 : 1);
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
