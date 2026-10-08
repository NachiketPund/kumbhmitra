import { db, type DbHealthResult } from "../db/connection.js";
import { config } from "../config/env.js";
import type { HealthStatus } from "../types/index.js";

export class HealthService {
  private startTime: number = Date.now();

  public async getHealth(): Promise<HealthStatus> {
    const memory = process.memoryUsage();
    const dbCheck: DbHealthResult = await db.checkConnection();

    let dbStatus: HealthStatus["database"]["status"];
    if (dbCheck.connected) {
      dbStatus = "connected";
    } else if (!config.database.url) {
      dbStatus = "unconfigured";
    } else {
      dbStatus = "disconnected";
    }

    return {
      status: dbCheck.connected ? "ok" : "degraded",
      service: "KumbhMitra Backend API",
      version: "1.0.0",
      environment: config.nodeEnv,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      memoryUsage: {
        heapUsedMB: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
      database: {
        status: dbStatus,
        provider: dbCheck.provider,
        latencyMs: dbCheck.latencyMs,
        ...(dbCheck.error ? { error: dbCheck.error } : {}),
      },
    };
  }
}

export const healthService = new HealthService();
export default healthService;
