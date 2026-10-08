/**
 * Emergency Controller
 *
 * Handles verified contact listing and SOS alert creation.
 *
 * IMPORTANT: This controller does NOT claim SMS/notification has
 * been sent unless a downstream sender confirms it. It only
 * records the alert in the database and returns its status.
 */
import type { Request, Response, NextFunction } from "../types/index.js";
import { db } from "../db/connection.js";
import { AppError } from "../middleware/errorHandler.js";
import { emergencyService } from "../services/emergency.service.js";

const VALID_CATEGORIES = ["police", "medical", "fire", "rescue", "helpline", "other"];

/** GET /api/emergency/contacts — verified active contacts only */
export async function listContacts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category } = req.query as Record<string, string>;
    if (category && !VALID_CATEGORIES.includes(category)) {
      throw new AppError(
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        400,
        "INVALID_FILTER"
      );
    }
    const contacts = await emergencyService.listContacts(category);
    res.status(200).json({
      success: true,
      data: contacts,
      note: "Only verified and active contacts are returned.",
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/emergency/contacts/:id */
export async function getContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const contact = await emergencyService.getById(req.params.id);
    res.status(200).json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/emergency/sos
 *
 * Records an SOS alert. Returns the created alert ID.
 *
 * IMPORTANT: This endpoint ONLY records the alert in the database.
 * It does NOT send SMS, call anyone, or notify police unless a
 * confirmed sender integration exists (none is configured here).
 * The response explicitly states which actions were performed
 * so the UI never displays "Police notified" falsely.
 */
export async function createSos(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { latitude, longitude, message } = req.body ?? {};
    const errors: Record<string, string> = {};

    if (latitude == null || isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90) {
      errors.latitude = "latitude is required and must be between -90 and 90";
    }
    if (longitude == null || isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180) {
      errors.longitude = "longitude is required and must be between -180 and 180";
    }
    if (message != null && (typeof message !== "string" || message.length > 300)) {
      errors.message = "message must be a string of at most 300 characters";
    }
    if (Object.keys(errors).length > 0) {
      throw new AppError("Validation failed", 400, "VALIDATION_ERROR", errors);
    }

    const result = await db.query<{ id: string; created_at: string }>(
      `INSERT INTO sos_alerts (latitude, longitude, message)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [Number(latitude), Number(longitude), message ?? null]
    );

    const created = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        created_at: created.created_at,
        status: "open",
      },
      actions: {
        recorded: true,
        sms_sent: false,
        call_initiated: false,
        location_shared: false,
        police_notified: false,
        note: "SOS alert recorded in database only. No SMS, call, or notification has been confirmed by any sender.",
      },
    });
  } catch (err) {
    next(err);
  }
}

export default { listContacts, getContact, createSos };
