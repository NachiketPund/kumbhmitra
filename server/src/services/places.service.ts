/**
 * Places Service
 * All database access for the `places` table lives here.
 * Controllers call these methods — they never touch the db directly.
 */
import { db } from "../db/connection.js";
import { AppError } from "../middleware/errorHandler.js";
import type { PlaceRow, PlaceCategory } from "../types/models.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ListPlacesOptions {
  category?: PlaceCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NearbyPlacesOptions {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  category?: PlaceCategory;
  limit?: number;
}

/** A place row with an added distance_km field (nearby queries only) */
export interface NearbyPlaceRow extends PlaceRow {
  distance_km: number;
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

export const placesService = {
  /**
   * List places with optional category filter, search, and pagination.
   * Only returns active places.
   */
  async list(options: ListPlacesOptions = {}): Promise<PaginatedResult<PlaceRow>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(200, Math.max(1, options.limit ?? 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["is_active = TRUE"];
    const params: any[] = [];

    if (options.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }
    if (options.search && options.search.trim().length > 0) {
      params.push(options.search.trim());
      conditions.push(
        `to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(address,'')) @@ plainto_tsquery('simple', $${params.length})`
      );
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM places ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    params.push(limit, offset);
    const dataResult = await db.query<PlaceRow>(
      `SELECT * FROM places
       ${where}
       ORDER BY category, name
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
   * Get a single place by ID. Throws 404 if not found.
   */
  async getById(id: string): Promise<PlaceRow> {
    if (!isValidUUID(id)) {
      throw new AppError("Invalid ID format", 400, "INVALID_ID");
    }
    const result = await db.query<PlaceRow>(
      "SELECT * FROM places WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError("Place not found", 404, "NOT_FOUND");
    }
    return result.rows[0];
  },

  /**
   * Find places near a coordinate, ordered by distance (closest first).
   *
   * Uses the Haversine formula computed in SQL so the database does the
   * distance math. Places without coordinates are excluded.
   *
   * @param latitude  -90..90
   * @param longitude -180..180
   * @param radiusKm  max distance in km (default 10)
   */
  async listNearby(
    options: NearbyPlacesOptions
  ): Promise<NearbyPlaceRow[]> {
    const { latitude, longitude } = options;
    const radiusKm = options.radiusKm ?? 10;
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));

    // Haversine distance in km. Earth radius = 6371 km.
    // $1 = lat, $2 = lng  → used both in the distance expression and the filter
    const conditions: string[] = [
      "is_active = TRUE",
      "latitude IS NOT NULL",
      "longitude IS NOT NULL",
    ];
    const params: any[] = [latitude, longitude];

    if (options.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    // Distance expression uses the same $1/$2 params
    const distanceExpr = `
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        ))
      ))`;

    params.push(radiusKm, limit);
    const radiusParam = `$${params.length - 1}`;
    const limitParam = `$${params.length}`;

    const result = await db.query<NearbyPlaceRow>(
      `SELECT *,
              ${distanceExpr} AS distance_km
       FROM places
       ${where}
         AND ${distanceExpr} <= ${radiusParam}
       ORDER BY distance_km ASC
       LIMIT ${limitParam}`,
      params
    );

    // pg returns NUMERIC as string; coerce distance to a number for the client
    return result.rows.map((row) => ({
      ...row,
      distance_km: Number(row.distance_km),
    }));
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export default placesService;
