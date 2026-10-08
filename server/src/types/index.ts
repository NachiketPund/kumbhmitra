export * from "./express.js";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  memoryUsage: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  database: {
    status: "connected" | "disconnected" | "simulated" | "unconfigured";
    provider?: string;
    latencyMs?: number;
    error?: string;
  };
}

export interface DatabaseConfig {
  url?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl: boolean;
  poolMax?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

export interface ServerConfig {
  port: number;
  nodeEnv: "development" | "production" | "test";
  corsOrigin: string[];
  /** Supabase JWT secret — used server-side to verify access tokens */
  supabaseJwtSecret: string;
  /** Supabase project URL — e.g. https://xyz.supabase.co */
  supabaseUrl: string;
  /** Supabase anon key — safe to use server-side for admin-less client ops */
  supabaseAnonKey: string;
  database: DatabaseConfig;
}
