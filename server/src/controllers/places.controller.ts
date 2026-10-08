/**
 * Places Controller
 * Handles HTTP layer: parse params/query, delegate to service, format response.
 *
 * Places are public read-only data — no auth required.
 */
import type { Request, Response, NextFunction } from "../types/index.js";
import { placesService } from "../services/places.service.js";
import { AppError } from "../middleware/errorHandler.js";
import type { PlaceCategory } from "../types/models.js";

const VALID_CATEGORIES: PlaceCategory[] = [
  "ghat", "camp", "parking", "hospital", "medical",
  "police", "toilet", "food", "transport", "temple",
  "landmark", "info_center", "help_centre", "other",
];

// ── GET /api/places ───────────────────────────────────────────────────────────

export async function listPlaces(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, search, page, limit } = req.query as Record<string, string>;

    if (category && !VALID_CATEGORIES.includes(category as PlaceCategory)) {
      throw new AppError(
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        400,
        "INVALID_FILTER"
      );
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError("page must be a positive integer", 400, "INVALID_PARAM");
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      throw new AppError("limit must be between 1 and 200", 400, "INVALID_PARAM");
    }

    const result = await placesService.list({
      category: category as PlaceCategory | undefined,
      search,
      page: pageNum,
      limit: limitNum,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/places/nearby ────────────────────────────────────────────────────
// NOTE: this must be registered BEFORE /:id so "nearby" isn't captured as an id.

export async function getNearbyPlaces(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = req.query as Record<string, string>;
    // Accept both `latitude`/`longitude` (canonical) and `lat`/`lng` (shorthand)
    const rawLat = query.latitude ?? query.lat;
    const rawLng = query.longitude ?? query.lng;
    const { radius, category, limit } = query;

    // Required coordinates
    if (rawLat === undefined || rawLng === undefined) {
      throw new AppError(
        "latitude and longitude query parameters are required",
        400,
        "MISSING_COORDINATES"
      );
    }

    const latitude = Number(rawLat);
    const longitude = Number(rawLng);

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new AppError("latitude must be between -90 and 90", 400, "INVALID_PARAM");
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError("longitude must be between -180 and 180", 400, "INVALID_PARAM");
    }

    let radiusKm = 10;
    if (radius !== undefined) {
      radiusKm = Number(radius);
      if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
        throw new AppError("radius must be between 0 and 500 (km)", 400, "INVALID_PARAM");
      }
    }

    if (category && !VALID_CATEGORIES.includes(category as PlaceCategory)) {
      throw new AppError(
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        400,
        "INVALID_FILTER"
      );
    }

    let limitNum = 20;
    if (limit !== undefined) {
      limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new AppError("limit must be between 1 and 100", 400, "INVALID_PARAM");
      }
    }

    const results = await placesService.listNearby({
      latitude,
      longitude,
      radiusKm,
      category: category as PlaceCategory | undefined,
      limit: limitNum,
    });

    res.status(200).json({
      success: true,
      data: results,
      meta: {
        latitude,
        longitude,
        radiusKm,
        count: results.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/places/:id ───────────────────────────────────────────────────────

export async function getPlace(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const place = await placesService.getById(id);
    res.status(200).json({ success: true, data: place });
  } catch (err) {
    next(err);
  }
}

export { VALID_CATEGORIES };

export default {
  listPlaces,
  getNearbyPlaces,
  getPlace,
};
