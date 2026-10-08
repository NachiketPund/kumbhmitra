/**
 * Plain Node.js (CJS) migration runner — no TypeScript, no tsx required.
 * Uses only the `pg` package which is already installed.
 *
 * Usage: node run-migrate.js
 *        DATABASE_URL=... node run-migrate.js
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

// ── Config ────────────────────────────────────────────────────────────────────
// Load .env manually (no dotenv dependency)
function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[MIGRATE] ERROR: DATABASE_URL not set. Add it to .env or export it.');
  process.exit(1);
}

// ── Pool ──────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('[MIGRATE] Pool error:', err.message));

// ── Helpers ───────────────────────────────────────────────────────────────────
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

/** Run a raw multi-statement SQL block via simple query protocol */
async function runRaw(sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied() {
  const result = await query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(result.rows.map((r) => r.filename));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const migrationsDir = path.join(__dirname, 'src', 'db', 'migrations');
  console.log('[MIGRATE] Migrations dir:', migrationsDir);
  console.log('[MIGRATE] Connecting…');

  // Quick connectivity check
  try {
    const r = await query('SELECT version()');
    console.log('[MIGRATE] Connected:', r.rows[0].version.split(' ').slice(0, 2).join(' '));
  } catch (err) {
    console.error('[MIGRATE] Cannot connect:', err.message);
    await pool.end();
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getApplied();

  if (!fs.existsSync(migrationsDir)) {
    console.error('[MIGRATE] Migrations directory not found:', migrationsDir);
    await pool.end();
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[MIGRATE] No .sql files found.');
    await pool.end();
    return;
  }

  console.log(`[MIGRATE] Found ${files.length} file(s): ${files.join(', ')}`);

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[MIGRATE] skip  ${file}  (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`[MIGRATE] apply ${file}  (${sql.length} bytes)`);

    try {
      await runRaw(sql);
      await query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [file]
      );
      ran++;
      console.log(`[MIGRATE] done  ${file}`);
    } catch (err) {
      console.error(`[MIGRATE] FAILED ${file}:`, err.message);
      if (err.detail) console.error('         detail:', err.detail);
      if (err.hint)   console.error('         hint:  ', err.hint);
      if (err.where)  console.error('         where: ', err.where);
      await pool.end();
      process.exit(1);
    }
  }

  console.log(`\n[MIGRATE] Done. ${ran} migration(s) applied.`);
  await pool.end();
}

main().catch((err) => {
  console.error('[MIGRATE] Unexpected error:', err);
  process.exit(1);
});
