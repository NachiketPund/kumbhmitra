import fs from "node:fs";
import path from "node:path";
import type { ServerConfig } from "../types/index.js";

/**
 * Lightweight .env parser — loads environment variables without external deps.
 * Reads .env from the process working directory (server/ root).
 */
function loadDotenv(envFilePath?: string): void {
  const targetPath = envFilePath || path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(targetPath)) return;

  try {
    const content = fs.readFileSync(targetPath, "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Gracefully ignore read errors
  }
}

loadDotenv();

const port = Number(process.env.PORT || 5000);
const nodeEnv = (process.env.NODE_ENV || "development") as ServerConfig["nodeEnv"];
// Fail closed: no CORS origin unless explicitly configured. Never default to "*".
const rawCors = process.env.CORS_ORIGIN || "";
const corsOrigin = rawCors.split(",").map((s: string) => s.trim()).filter(Boolean);

/**
 * Resolve database URL from either:
 *  1. DATABASE_URL (preferred — supports Supabase connection string)
 *  2. SUPABASE_* individual parameters
 *  3. Legacy PG* individual parameters
 */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Construct from Supabase env vars
  const supaHost = process.env.SUPABASE_DB_HOST;
  const supaUser = process.env.SUPABASE_DB_USER || "postgres";
  const supaPass = process.env.SUPABASE_DB_PASSWORD;
  const supaDb = process.env.SUPABASE_DB_NAME || "postgres";
  const supaPort = process.env.SUPABASE_DB_PORT || "5432";
  if (supaHost && supaPass) {
    return `postgresql://${supaUser}:${encodeURIComponent(supaPass)}@${supaHost}:${supaPort}/${supaDb}`;
  }

  // Construct from legacy PG* vars
  const pgHost = process.env.PGHOST;
  const pgUser = process.env.PGUSER;
  const pgPass = process.env.PGPASSWORD;
  const pgDb = process.env.PGDATABASE;
  const pgPort = process.env.PGPORT || "5432";
  if (pgHost && pgUser && pgPass && pgDb) {
    return `postgresql://${pgUser}:${encodeURIComponent(pgPass)}@${pgHost}:${pgPort}/${pgDb}`;
  }

  return undefined;
}

/**
 * Determine SSL requirement.
 * Supabase always requires SSL. LOCAL/non-Supabase dev may not.
 */
function resolveSSL(): boolean {
  // Explicit override
  if (process.env.PGSSL !== undefined) return process.env.PGSSL === "true";
  // Supabase connections always use SSL
  if (process.env.SUPABASE_DB_HOST) return true;
  // DATABASE_URL pointing to supabase.co
  if (process.env.DATABASE_URL?.includes("supabase.co")) return true;
  return false;
}

const dbHost =
  process.env.SUPABASE_DB_HOST ||
  process.env.PGHOST ||
  "localhost";

const dbUser =
  process.env.SUPABASE_DB_USER ||
  process.env.PGUSER ||
  "postgres";

const dbName =
  process.env.SUPABASE_DB_NAME ||
  process.env.PGDATABASE ||
  "kumbhmitra";

const dbPort = Number(
  process.env.SUPABASE_DB_PORT || process.env.PGPORT || 5432
);

export const config: ServerConfig = {
  port: Number.isNaN(port) ? 5000 : port,
  nodeEnv,
  corsOrigin,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  database: {
    url: resolveDatabaseUrl(),
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || "",
    database: dbName,
    ssl: resolveSSL(),
    poolMax: Number(process.env.DB_MAX_CONNECTIONS || 20),
    idleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  },
};

export default config;
