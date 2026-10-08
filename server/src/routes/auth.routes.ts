/**
 * Auth Routes
 * Mounted at /api/auth in routes/index.ts
 *
 * These endpoints are thin wrappers — actual registration/login happens
 * via Supabase Auth on the frontend. The backend just:
 *  1. Verifies the token and returns the synced user profile (GET /api/auth/me)
 *  2. Provides a token-check endpoint for the frontend to validate sessions
 */
import { Router } from "../core/express.js";
import { requireAuth } from "../middleware/auth.js";
import type { Request, Response, NextFunction } from "../types/index.js";
import { userSyncService } from "../services/user-sync.service.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 * Frontend calls this on app load to restore session state.
 */
router.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await userSyncService.getByAuthId(req.user!.id);
      if (!user) {
        throw new AppError("User profile not found", 404, "NOT_FOUND");
      }
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/auth/me
 * Update display_name or language for the authenticated user.
 */
router.patch(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { display_name, language } = req.body ?? {};

      const VALID_LANGUAGES = ["en", "hi", "mr", "gu", "te", "ta", "kn", "raj"];
      const errors: Record<string, string> = {};

      if (display_name !== undefined) {
        if (typeof display_name !== "string" || display_name.trim().length === 0)
          errors.display_name = "display_name must be a non-empty string";
        else if (display_name.trim().length > 100)
          errors.display_name = "display_name must not exceed 100 characters";
      }
      if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
        errors.language = `language must be one of: ${VALID_LANGUAGES.join(", ")}`;
      }
      if (Object.keys(errors).length > 0) {
        throw new AppError("Validation failed", 400, "VALIDATION_ERROR", errors);
      }

      const updated = await userSyncService.updateProfile(req.user!.id, {
        display_name: display_name?.trim(),
        language,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
