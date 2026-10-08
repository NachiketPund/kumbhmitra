/**
 * Admin Service
 * Admin-only operations. All callers must pass requireAdmin middleware first.
 */
import { db } from "../db/connection.js";
import type { UserRow } from "../types/models.js";

const VALID_ROLES = new Set(["USER", "ADMIN"]);

export const adminService = {
  // ── Dashboard stats ──────────────────────────────────────────────
  async stats(): Promise<{
    users: number; openReports: number; activeCrowd: number;
    activePlaces: number; verifiedEmergency: number; activeEvents: number; activeAnnouncements: number;
  }> {
    const [users, openReports, activeCrowd, activePlaces, verifiedEmergency, activeEvents, activeAnnouncements] = await Promise.all([
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE is_active = TRUE"),
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM lost_found WHERE status = 'open'"),
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM crowd_updates WHERE is_active = TRUE"),
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM places WHERE is_active = TRUE"),
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM emergency_services WHERE verified = TRUE AND is_active = TRUE"),
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM events WHERE is_active = TRUE"),
      db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM announcements WHERE active = TRUE"),
    ]);
    return {
      users: Number(users.rows[0].count),
      openReports: Number(openReports.rows[0].count),
      activeCrowd: Number(activeCrowd.rows[0].count),
      activePlaces: Number(activePlaces.rows[0].count),
      verifiedEmergency: Number(verifiedEmergency.rows[0].count),
      activeEvents: Number(activeEvents.rows[0].count),
      activeAnnouncements: Number(activeAnnouncements.rows[0].count),
    };
  },

  // ── Users ──────────────────────────────────────────────────────
  async listUsers(limit = 50, offset = 0): Promise<UserRow[]> {
    const r = await db.query<UserRow>(
      "SELECT id, auth_id, display_name, phone, email, language, is_active, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    return r.rows;
  },

  async setUserRole(userId: string, role: string): Promise<UserRow | null> {
    if (!VALID_ROLES.has(role)) throw new Error("Invalid role");
    const r = await db.query<UserRow>(
      "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [role, userId]
    );
    return r.rows[0] ?? null;
  },

  async setUserActive(userId: string, isActive: boolean): Promise<UserRow | null> {
    const r = await db.query<UserRow>(
      "UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [isActive, userId]
    );
    return r.rows[0] ?? null;
  },

  // ── Lost & Found admin actions ─────────────────────────────────
  async setLostFoundStatus(id: string, status: "open" | "resolved" | "expired"): Promise<{ id: string; status: string } | null> {
    const r = await db.query<{ id: string; status: string }>(
      "UPDATE lost_found SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status",
      [status, id]
    );
    return r.rows[0] ?? null;
  },

  // ── Places admin CRUD ──────────────────────────────────────────
  async createPlace(data: {
    name: string; category: string; description?: string | null;
    address?: string | null; latitude?: number | null; longitude?: number | null;
  }): Promise<{ id: string }> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO places (name, category, description, address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.name, data.category, data.description ?? null, data.address ?? null, data.latitude ?? null, data.longitude ?? null]
    );
    return r.rows[0];
  },

  async updatePlace(id: string, patch: Record<string, any>): Promise<{ id: string } | null> {
    const allowed = new Set(["name", "category", "description", "address", "latitude", "longitude", "is_active"]);
    const keys = Object.keys(patch).filter(k => allowed.has(k) && patch[k] !== undefined);
    if (keys.length === 0) throw new Error("No valid fields to update");
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const r = await db.query<{ id: string }>(
      `UPDATE places SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING id`,
      [...keys.map(k => patch[k]), id]
    );
    return r.rows[0] ?? null;
  },

  async deletePlace(id: string): Promise<{ deleted: boolean }> {
    const r = await db.query<{ id: string }>("DELETE FROM places WHERE id = $1 RETURNING id", [id]);
    return { deleted: r.rowCount > 0 };
  },

  // ── Emergency services admin CRUD ──────────────────────────────
  async createEmergencyService(data: {
    name: string; category: string; phone: string;
    address?: string | null; latitude?: number | null; longitude?: number | null;
    verified?: boolean;
  }): Promise<{ id: string }> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO emergency_services (name, category, phone, address, latitude, longitude, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.name, data.category, data.phone, data.address ?? null, data.latitude ?? null, data.longitude ?? null, data.verified ?? false]
    );
    return r.rows[0];
  },

  async updateEmergencyService(id: string, patch: Record<string, any>): Promise<{ id: string } | null> {
    const allowed = new Set(["name", "category", "phone", "address", "latitude", "longitude", "verified", "is_active"]);
    const keys = Object.keys(patch).filter(k => allowed.has(k) && patch[k] !== undefined);
    if (keys.length === 0) throw new Error("No valid fields to update");
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const r = await db.query<{ id: string }>(
      `UPDATE emergency_services SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING id`,
      [...keys.map(k => patch[k]), id]
    );
    return r.rows[0] ?? null;
  },

  async deleteEmergencyService(id: string): Promise<{ deleted: boolean }> {
    const r = await db.query<{ id: string }>("DELETE FROM emergency_services WHERE id = $1 RETURNING id", [id]);
    return { deleted: r.rowCount > 0 };
  },

  // ── Events admin CRUD ──────────────────────────────────────────
  async createEvent(data: {
    title: string; category: string; starts_at: string; ends_at?: string | null;
    description?: string | null; place_id?: string | null; language?: string;
  }): Promise<{ id: string }> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO events (title, category, starts_at, ends_at, description, place_id, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.title, data.category, data.starts_at, data.ends_at ?? null, data.description ?? null, data.place_id ?? null, data.language ?? "en"]
    );
    return r.rows[0];
  },

  async updateEvent(id: string, patch: Record<string, any>): Promise<{ id: string } | null> {
    const allowed = new Set(["title", "category", "starts_at", "ends_at", "description", "place_id", "language", "is_active"]);
    const keys = Object.keys(patch).filter(k => allowed.has(k) && patch[k] !== undefined);
    if (keys.length === 0) throw new Error("No valid fields to update");
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const r = await db.query<{ id: string }>(
      `UPDATE events SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING id`,
      [...keys.map(k => patch[k]), id]
    );
    return r.rows[0] ?? null;
  },

  async deleteEvent(id: string): Promise<{ deleted: boolean }> {
    const r = await db.query<{ id: string }>("DELETE FROM events WHERE id = $1 RETURNING id", [id]);
    return { deleted: r.rowCount > 0 };
  },

  // ── Announcements admin CRUD ───────────────────────────────────
  async createAnnouncement(data: {
    title: string; body: string; priority?: string; language?: string;
    active?: boolean; starts_at?: string | null; ends_at?: string | null; place_id?: string | null;
  }): Promise<{ id: string }> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO announcements (title, body, priority, language, active, starts_at, ends_at, place_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [data.title, data.body, data.priority ?? "normal", data.language ?? "en", data.active ?? true, data.starts_at ?? null, data.ends_at ?? null, data.place_id ?? null]
    );
    return r.rows[0];
  },

  async updateAnnouncement(id: string, patch: Record<string, any>): Promise<{ id: string } | null> {
    const allowed = new Set(["title", "body", "priority", "language", "active", "starts_at", "ends_at", "place_id"]);
    const keys = Object.keys(patch).filter(k => allowed.has(k) && patch[k] !== undefined);
    if (keys.length === 0) throw new Error("No valid fields to update");
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const r = await db.query<{ id: string }>(
      `UPDATE announcements SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING id`,
      [...keys.map(k => patch[k]), id]
    );
    return r.rows[0] ?? null;
  },

  async deleteAnnouncement(id: string): Promise<{ deleted: boolean }> {
    const r = await db.query<{ id: string }>("DELETE FROM announcements WHERE id = $1 RETURNING id", [id]);
    return { deleted: r.rowCount > 0 };
  },
};
