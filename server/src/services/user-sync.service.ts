/**
 * User Sync Service
 *
 * When a Supabase Auth user hits an authenticated endpoint, we upsert
 * a corresponding row in our `users` table so we can attach app-level
 * data (lost & found reports etc.) to the user.
 *
 * The users.auth_id column stores the Supabase Auth UUID.
 * This is the join key between Supabase Auth and our users table.
 */
import { db } from "../db/connection.js";
import type { UserRow } from "../types/models.js";

interface SyncUserInput {
  authId: string;
  email?: string;
}

export const userSyncService = {
  /**
   * Upsert a user by their Supabase Auth ID.
   * Creates the row on first login, updates email if it changed.
   * Returns the users.id (same UUID as auth_id by convention).
   */
  async syncUser(input: SyncUserInput): Promise<{ dbUserId: string; role: string }> {
    const result = await db.query<UserRow>(
      `INSERT INTO users (auth_id, email, is_active, role)
       VALUES ($1, $2, TRUE, 'USER')
       ON CONFLICT (auth_id) DO UPDATE
         SET email = EXCLUDED.email,
             updated_at = NOW()
       RETURNING id, role`,
      [input.authId, input.email ?? null]
    );
    const row = result.rows[0];
    return { dbUserId: row.id, role: row.role ?? 'USER' };
  },

  /**
   * Get a user's full profile row by their Supabase Auth ID.
   * Returns null if not found (user hasn't hit an auth'd endpoint yet).
   */
  async getByAuthId(authId: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      "SELECT * FROM users WHERE auth_id = $1",
      [authId]
    );
    return result.rows[0] ?? null;
  },

  /**
   * Update display_name and/or language for a user.
   */
  async updateProfile(
    authId: string,
    patch: { display_name?: string; language?: string }
  ): Promise<UserRow | null> {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (patch.display_name !== undefined) {
      params.push(patch.display_name);
      setClauses.push(`display_name = $${params.length}`);
    }
    if (patch.language !== undefined) {
      params.push(patch.language);
      setClauses.push(`language = $${params.length}`);
    }
    if (setClauses.length === 0) return null;

    params.push(authId);
    const result = await db.query<UserRow>(
      `UPDATE users
       SET ${setClauses.join(", ")}
       WHERE auth_id = $${params.length}
       RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  },
};

export default userSyncService;
