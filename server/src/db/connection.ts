import { config } from "../config/env.js";

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  /** Execute a raw multi-statement SQL block via the simple query protocol.
   *  Do NOT pass user-supplied input here — no parameterisation. */
  runRaw(sql: string): Promise<void>;
  checkConnection(): Promise<DbHealthResult>;
  close(): Promise<void>;
}

export interface DbHealthResult {
  connected: boolean;
  provider: string;
  host: string;
  database: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Supabase/PostgreSQL Pool Connection.
 *
 * The `pg` module is resolved at runtime. This allows the backend to build
 * without pg installed locally (CI/type-check), but requires pg at runtime.
 *
 * Install: npm install pg --save
 * Types:   npm install @types/pg --save-dev
 *
 * Connection credentials are loaded exclusively from environment variables —
 * NEVER hard-coded here. See .env.example for all required keys.
 */
class PoolDatabaseService implements IDatabaseClient {
  private pool: any = null;
  private initialized = false;

  private async ensurePool(): Promise<any> {
    if (this.pool) return this.pool;
    if (this.initialized) return null;
    this.initialized = true;

    const dbUrl = config.database.url;
    const useSSL = config.database.ssl;

    if (!dbUrl) {
      console.warn(
        "[DB] No DATABASE_URL configured. Database operations will be unavailable.\n" +
        "    Set DATABASE_URL (or SUPABASE_DB_* vars) in your .env file."
      );
      return null;
    }

    try {
      // Dynamic import so the module is optional at build time
      const pg = await import("pg");
      const { Pool } = pg.default ?? pg;

      const poolConfig: any = {
        connectionString: dbUrl,
        max: config.database.poolMax ?? 20,
        idleTimeoutMillis: config.database.idleTimeoutMs ?? 30000,
        connectionTimeoutMillis: config.database.connectionTimeoutMs ?? 5000,
      };

      // SSL is required for Supabase and recommended for any remote Postgres.
      // rejectUnauthorized: false is intentional for Supabase's connection pooler
      // (port 6543) — the connection is still fully TLS-encrypted.
      if (useSSL) {
        poolConfig.ssl = {
          rejectUnauthorized: false,
        };
      }

      this.pool = new Pool(poolConfig);

      // Surface pool errors without crashing the process
      this.pool.on("error", (err: Error) => {
        console.error("[DB] Pool error:", err.message);
      });

      console.log(
        `[DB] Pool created → host: ${config.database.host} | ` +
        `db: ${config.database.database} | ssl: ${useSSL} | max: ${poolConfig.max}`
      );
      return this.pool;
    } catch (err: any) {
      console.error("[DB] Failed to initialise pg pool:", err.message);
      console.error(
        "     Ensure pg is installed: npm install pg --prefix server"
      );
      return null;
    }
  }

  private getPool(): any {
    if (!this.pool) {
      throw new Error(
        "Database not configured. Set DATABASE_URL in .env and install the pg package."
      );
    }
    return this.pool;
  }

  public async query<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    await this.ensurePool();
    const pool = this.getPool();

    const result = await pool.query(sql, params);
    // pg can return an array of results for simple (multi-statement) queries.
    // Normalise to a single result object.
    if (Array.isArray(result)) {
      const last = result[result.length - 1] ?? { rows: [], rowCount: 0 };
      return {
        rows: last.rows ?? [],
        rowCount: last.rowCount ?? 0,
      };
    }
    return {
      rows: result.rows ?? [],
      rowCount: result.rowCount ?? 0,
    };
  }

  /**
   * Execute a raw SQL string that may contain multiple statements
   * (e.g. migration files with BEGIN…COMMIT blocks).
   *
   * This checks out a dedicated client from the pool and calls
   * client.query() directly, which uses the simple query protocol
   * and supports multi-statement strings without parameters.
   *
   * SECURITY: Never pass user-supplied data into this method.
   */
  public async runRaw(sql: string): Promise<void> {
    await this.ensurePool();
    const pool = this.getPool();

    const client = await pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }

  public async checkConnection(): Promise<DbHealthResult> {
    const base: DbHealthResult = {
      connected: false,
      provider: config.database.url?.includes("supabase.co")
        ? "Supabase PostgreSQL"
        : "PostgreSQL",
      host: config.database.host,
      database: config.database.database,
    };

    if (!config.database.url) {
      return {
        ...base,
        error: "DATABASE_URL not set",
      };
    }

    const start = Date.now();
    try {
      await this.query<{ server_version: string; now: string }>(
        "SELECT version() AS server_version, NOW() AS now"
      );
      return {
        ...base,
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        ...base,
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      console.log("[DB] Pool closed cleanly.");
    }
  }
}

export const db: IDatabaseClient = new PoolDatabaseService();
export default db;
