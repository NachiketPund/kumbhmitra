/**
 * Lost & Found Controller
 * Handles HTTP layer: parse params/query/body, delegate to service, format response.
 *
 * Auth: Read ops publicly available. Write ops (POST, PUT, DELETE) require a valid
 * req.user.dbUserId (attached by requireAuth middleware).
 */
import type { Request, Response, NextFunction } from "../types/index.js";
import { lostFoundService } from "../services/lost-found.service.js";
import { AppError } from "../middleware/errorHandler.js";
import type {
  LostFoundType,
  LostFoundStatus,
  LostFoundCategory,
  LostFoundRow,
} from "../types/models.js";

const VALID_TYPES: LostFoundType[] = ["lost", "found"];
const VALID_STATUSES: LostFoundStatus[] = ["open", "resolved", "expired"];
const VALID_CATEGORIES: LostFoundCategory[] = [
  "person", "child", "bag", "document",
  "phone", "wallet", "jewellery", "clothing",
  "vehicle", "animal", "other",
];

// ── GET /api/lost-found ───────────────────────────────────────────────────────

export async function listLostFound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { type, status, category, search, page, limit } = req.query as Record<string, string>;

    // Validate enum filters if provided
    if (type && !VALID_TYPES.includes(type as LostFoundType)) {
      throw new AppError(
        `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
        400,
        "INVALID_FILTER"
      );
    }
    if (status && !VALID_STATUSES.includes(status as LostFoundStatus)) {
      throw new AppError(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        400,
        "INVALID_FILTER"
      );
    }
    if (category && !VALID_CATEGORIES.includes(category as LostFoundCategory)) {
      throw new AppError(
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        400,
        "INVALID_FILTER"
      );
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError("page must be a positive integer", 400, "INVALID_PARAM");
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new AppError("limit must be between 1 and 100", 400, "INVALID_PARAM");
    }

    const result = await lostFoundService.list({
      type: type as LostFoundType | undefined,
      status: status as LostFoundStatus | undefined,
      category: category as LostFoundCategory | undefined,
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

// ── GET /api/lost-found/:id ───────────────────────────────────────────────────

export async function getLostFound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const item = await lostFoundService.getById(id);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/lost-found ──────────────────────────────────────────────────────

export async function createLostFound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { type, title, description, category, location, latitude, longitude, image_url } =
      req.body ?? {};

    // Internal users.id (UUID)
    const dbUserId = req.user!.dbUserId;
    if (!dbUserId) {
      // Should not happen as requireAuth ensures dbUserId is synced
      throw new AppError("A synced user profile is required", 401, "UNAUTHORIZED");
    }

    // Required field validation
    const errors: Record<string, string> = {};
    if (!type) errors.type = "type is required";
    else if (!VALID_TYPES.includes(type)) errors.type = `Must be one of: ${VALID_TYPES.join(", ")}`;

    if (!title || typeof title !== "string" || title.trim().length < 2)
      errors.title = "title must be at least 2 characters";
    else if (title.trim().length > 120)
      errors.title = "title must not exceed 120 characters";

    if (!category) errors.category = "category is required";
    else if (!VALID_CATEGORIES.includes(category))
      errors.category = `Must be one of: ${VALID_CATEGORIES.join(", ")}`;

    if (!location || typeof location !== "string" || location.trim().length < 2)
      errors.location = "location must be at least 2 characters";
    else if (location.trim().length > 200)
      errors.location = "location must not exceed 200 characters";

    if (description !== undefined && description !== null) {
      if (typeof description !== "string")
        errors.description = "description must be a string";
      else if (description.length > 500)
        errors.description = "description must not exceed 500 characters";
    }

    if (latitude !== undefined && latitude !== null) {
      const lat = Number(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90)
        errors.latitude = "latitude must be between -90 and 90";
    }
    if (longitude !== undefined && longitude !== null) {
      const lng = Number(longitude);
      if (isNaN(lng) || lng < -180 || lng > 180)
        errors.longitude = "longitude must be between -180 and 180";
    }
    if (image_url && !/^https?:\/\//i.test(image_url)) {
      errors.image_url = "image_url must be a valid http or https URL";
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError("Validation failed", 400, "VALIDATION_ERROR", errors);
    }

    const item = await lostFoundService.create({
      type,
      title,
      description: description ?? null,
      category,
      location,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      image_url: image_url ?? null,
      user_id: dbUserId, // Explicitly link report to the authenticated user
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/lost-found/:id ───────────────────────────────────────────────────

export async function updateLostFound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { title, description, category, location, latitude, longitude, image_url, status } =
      req.body ?? {};

    const dbUserId = req.user!.dbUserId;
    if (!dbUserId) {
      throw new AppError("A synced user profile is required", 401, "UNAUTHORIZED");
    }

    // 1. Fetch item to confirm existence and check ownership
    const existing = await lostFoundService.getById(id);
    checkOwnership(existing, dbUserId);

    // 2. Validate only the fields that were actually provided
    const errors: Record<string, string> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length < 2)
        errors.title = "title must be at least 2 characters";
      else if (title.trim().length > 120)
        errors.title = "title must not exceed 120 characters";
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category))
      errors.category = `Must be one of: ${VALID_CATEGORIES.join(", ")}`;

    if (location !== undefined) {
      if (typeof location !== "string" || location.trim().length < 2)
        errors.location = "location must be at least 2 characters";
      else if (location.trim().length > 200)
        errors.location = "location must not exceed 200 characters";
    }
    if (description !== undefined && description !== null) {
      if (typeof description !== "string")
        errors.description = "description must be a string";
      else if (description.length > 500)
        errors.description = "description must not exceed 500 characters";
    }
    if (status !== undefined && !VALID_STATUSES.includes(status))
      errors.status = `Must be one of: ${VALID_STATUSES.join(", ")}`;

    if (latitude !== undefined && latitude !== null) {
      const lat = Number(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90)
        errors.latitude = "latitude must be between -90 and 90";
    }
    if (longitude !== undefined && longitude !== null) {
      const lng = Number(longitude);
      if (isNaN(lng) || lng < -180 || lng > 180)
        errors.longitude = "longitude must be between -180 and 180";
    }
    if (image_url !== undefined && image_url !== null && !/^https?:\/\//i.test(image_url)) {
      errors.image_url = "image_url must be a valid http or https URL";
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError("Validation failed", 400, "VALIDATION_ERROR", errors);
    }

    // 3. Apply update
    const item = await lostFoundService.update(id, {
      title,
      description,
      category,
      location,
      latitude: latitude != null ? Number(latitude) : latitude,
      longitude: longitude != null ? Number(longitude) : longitude,
      image_url,
      status,
    });

    res.status(200).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/lost-found/:id ────────────────────────────────────────────────

export async function deleteLostFound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const dbUserId = req.user!.dbUserId;
    if (!dbUserId) {
      throw new AppError("A synced user profile is required", 401, "UNAUTHORIZED");
    }

    // 1. Fetch item to confirm existence and check ownership
    const existing = await lostFoundService.getById(id);
    checkOwnership(existing, dbUserId);

    // 2. Delete
    await lostFoundService.delete(id);
    res.status(200).json({ success: true, message: "Report deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Throws 403 Forbidden if the user is not the owner of the report */
function checkOwnership(item: LostFoundRow, dbUserId: string): void {
  const ownerId = item.user_id;
  if (!ownerId) {
    // Unowned (anonymous) report — no one can edit or delete it (admin required)
    throw new AppError(
      "Anonymous reports cannot be modified after submission. Contact an administrator.",
      403,
      "FORBIDDEN"
    );
  }

  if (ownerId !== dbUserId) {
    // Report belongs to someone else
    throw new AppError(
      `You do not own this report. Only the original reporter (${ownerId.slice(
        0,
        8
      )}) can modify or delete it.`,
      403,
      "FORBIDDEN"
    );
  }
}

export default {
  listLostFound,
  getLostFound,
  createLostFound,
  updateLostFound,
  deleteLostFound,
};
