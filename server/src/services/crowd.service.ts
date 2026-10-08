/**
 * Crowd Service
 * Data-driven crowd updates linked to places.
 */
import { db } from "../db/connection.js";
import { AppError } from "../middleware/errorHandler.js";
import type { CrowdUpdateRow } from "../types/models.js";

export type CrowdLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export const crowdService = {
  /** List active crowd updates, optionally filtered by place */
  async list(placeId?: string): Promise<CrowdUpdateRow[]> {
    const conditions = ["is_active = TRUE"];
    const params: any[] = [];
    if (placeId) {
      params.push(placeId);
      conditions.push(`place_id = $${params.length}`);
    }
    const result = await db.query<CrowdUpdateRow>(
      `SELECT * FROM crowd_updates WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  },

  /** Get latest active crowd update for a place */
  async getByPlace(placeId: string): Promise<CrowdUpdateRow | null> {
    const result = await db.query<CrowdUpdateRow>(
      `SELECT * FROM crowd_updates
       WHERE is_active = TRUE AND place_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [placeId]
    );
    return result.rows[0] ?? null;
  },

  /** Admin: create or update crowd info for a place */
  async update(placeId: string, updates: { density?: number; message?: string; language?: string; is_active?: boolean; expires_at?: string | null }): Promise<CrowdUpdateRow> {
    // Deactivate any existing active for this place to keep one active at a time
    await db.query(`UPDATE crowd_updates SET is_active = FALSE WHERE place_id = $1 AND is_active = TRUE`, [placeId]);

    const result = await db.query<CrowdUpdateRow>(
      `INSERT INTO crowd_updates (place_id, density, message, language, is_active, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, $5, NOW(), NOW())
       RETURNING *`,
      [
        placeId,
        updates.density ?? 3,
        updates.message ?? "No current advisory.",
        updates.language ?? "en",
        updates.expires_at ?? null,
      ]
    );
    return result.rows[0];
  },
};

export function densityToLevel(d: number): CrowdLevel {
  if (d <= 1) return "LOW";
  if (d <= 2) return "MODERATE";
  if (d <= 3) return "HIGH";
  return "VERY_HIGH";
}
