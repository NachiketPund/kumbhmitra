/**
 * Emergency Service
 *
 * Provides verified emergency contacts from the database.
 * Does NOT claim notifications have been sent unless confirmed.
 */
import { db } from "../db/connection.js";
import { AppError } from "../middleware/errorHandler.js";
import type { EmergencyServiceRow } from "../types/models.js";

export const emergencyService = {
  /**
   * List verified emergency contacts, optionally filtered by category.
   * Only returns is_active = TRUE and verified = TRUE.
   */
  async listContacts(
    category?: string
  ): Promise<EmergencyServiceRow[]> {
    const conditions = ["is_active = TRUE", "verified = TRUE"];
    const params: any[] = [];
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    const result = await db.query<EmergencyServiceRow>(
      `SELECT id, name, category, phone, address, latitude, longitude, verified, is_active, created_at, updated_at
       FROM emergency_services
       WHERE ${conditions.join(" AND ")}
       ORDER BY category, name`,
      params
    );
    return result.rows;
  },

  /**
   * Get a single verified contact by ID.
   */
  async getById(id: string): Promise<EmergencyServiceRow> {
    if (!isUuid(id)) {
      throw new AppError("Invalid ID", 400, "INVALID_ID");
    }
    const result = await db.query<EmergencyServiceRow>(
      "SELECT * FROM emergency_services WHERE id = $1 AND verified = TRUE AND is_active = TRUE",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError("Verified emergency contact not found", 404, "NOT_FOUND");
    }
    return result.rows[0];
  },
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
