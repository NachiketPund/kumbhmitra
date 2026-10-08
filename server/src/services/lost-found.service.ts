/**
 * Lost & Found Service
 * All database access for the lost_found table lives here.
 * Controllers call these methods — they never touch the db directly.
 */
import { db } from "../db/connection.js";
import { AppError } from "../middleware/errorHandler.js";
import type {
  LostFoundRow,
  LostFoundType,
  LostFoundStatus,
  LostFoundCategory,
} from "../types/models.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateLostFoundInput {
  type: LostFoundType;
  title: string;
  description?: string | null;
  category: LostFoundCategory;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  user_id?: string | null;
}

export interface UpdateLostFoundInput {
  title?: string;
  description?: string | null;
  category?: LostFoundCategory;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  status?: LostFoundStatus;
}

export interface ListLostFoundOptions {
  type?: LostFoundType;
  status?: LostFoundStatus;
  category?: LostFoundCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export const lostFoundService = {
  /**
   * List lost & found items with optional filters and pagination.
   */
  async list(
    options: ListLostFoundOptions = {}
  ): Promise<PaginatedResult<LostFoundRow>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    // Build WHERE clauses dynamically using parameterised queries
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      params.push(options.type);
      conditions.push(`type = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }
    if (options.search && options.search.trim().length > 0) {
      // Full-text search across title, description, location using the GIN index
      params.push(options.search.trim());
      conditions.push(
        `to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'')) @@ plainto_tsquery('simple', $${params.length})`
      );
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total for pagination
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM lost_found ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    // Fetch page
    params.push(limit, offset);
    const dataResult = await db.query<LostFoundRow>(
      `SELECT * FROM lost_found
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const totalPages = Math.ceil(total / limit);
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  /**
   * Get a single item by ID. Throws 404 if not found.
   */
  async getById(id: string): Promise<LostFoundRow> {
    if (!isValidUUID(id)) {
      throw new AppError("Invalid ID format", 400, "INVALID_ID");
    }
    const result = await db.query<LostFoundRow>(
      "SELECT * FROM lost_found WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError("Report not found", 404, "NOT_FOUND");
    }
    return result.rows[0];
  },

  /**
   * Create a new lost & found report.
   */
  async create(input: CreateLostFoundInput): Promise<LostFoundRow> {
    const result = await db.query<LostFoundRow>(
      `INSERT INTO lost_found
         (user_id, type, title, description, category,
          location, latitude, longitude, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.user_id ?? null,
        input.type,
        input.title.trim(),
        input.description?.trim() ?? null,
        input.category,
        input.location.trim(),
        input.latitude ?? null,
        input.longitude ?? null,
        input.image_url ?? null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Update an existing report. Throws 404 if not found.
   * Only updates fields that are explicitly provided.
   */
  async update(id: string, input: UpdateLostFoundInput): Promise<LostFoundRow> {
    if (!isValidUUID(id)) {
      throw new AppError("Invalid ID format", 400, "INVALID_ID");
    }

    // Build SET clause from only the provided fields
    const setClauses: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, any> = {
      title: input.title?.trim(),
      description: input.description,
      category: input.category,
      location: input.location?.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      image_url: input.image_url,
      status: input.status,
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        params.push(val);
        setClauses.push(`${key} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATE_FIELDS");
    }

    params.push(id);
    const result = await db.query<LostFoundRow>(
      `UPDATE lost_found
       SET ${setClauses.join(", ")}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new AppError("Report not found", 404, "NOT_FOUND");
    }
    return result.rows[0];
  },

  /**
   * Delete a report by ID. Throws 404 if not found.
   */
  async delete(id: string): Promise<void> {
    if (!isValidUUID(id)) {
      throw new AppError("Invalid ID format", 400, "INVALID_ID");
    }
    const result = await db.query<LostFoundRow>(
      "DELETE FROM lost_found WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError("Report not found", 404, "NOT_FOUND");
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export default lostFoundService;
