/**
 * Minimal type declarations for the `pg` package.
 * These allow the project to type-check without `pg` installed.
 * At runtime, `npm install pg` provides the real implementation.
 */
declare module "pg" {
  import type { EventEmitter } from "node:events";

  export interface PoolConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string };
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }

  export interface QueryResult<T = any> {
    rows: T[];
    rowCount: number | null;
    command: string;
  }

  export class Pool extends EventEmitter {
    constructor(config?: PoolConfig);
    query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  const pg: { Pool: typeof Pool };
  export default pg;
}
