/**
 * Crowd Controller
 * Public reads + admin-protected update.
 */
import type { Request, Response, NextFunction } from "../types/index.js";
import { crowdService, densityToLevel } from "../services/crowd.service.js";
import { AppError } from "../middleware/errorHandler.js";

export async function listCrowd(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { placeId } = req.query as Record<string, string>;
    const items = await crowdService.list(placeId);
    res.status(200).json({
      success: true,
      data: items.map((r) => ({
        ...r,
        level: densityToLevel(r.density),
      })),
    });
  } catch (err) { next(err); }
}

export async function getCrowdByPlace(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const item = await crowdService.getByPlace(req.params.placeId);
    if (!item) throw new AppError("No crowd update found for this place", 404, "NOT_FOUND");
    res.status(200).json({
      success: true,
      data: { ...item, level: densityToLevel(item.density) },
    });
  } catch (err) { next(err); }
}

export async function updateCrowd(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    // Admin protection: require valid auth (reuse auth middleware or check role)
    // For this project, we assume admin is handled by auth middleware on route mount.
    const { placeId } = req.params;
    const { density, message, language, is_active, expires_at } = req.body ?? {};

    if (density !== undefined && (typeof density !== "number" || density < 1 || density > 5)) {
      throw new AppError("density must be 1-5", 400, "INVALID_PARAM");
    }

    const updated = await crowdService.update(placeId, {
      density,
      message,
      language,
      is_active,
      expires_at,
    });

    res.status(200).json({
      success: true,
      data: { ...updated, level: densityToLevel(updated.density) },
      note: "Admin update completed. Only verified data shown.",
    });
  } catch (err) { next(err); }
}
