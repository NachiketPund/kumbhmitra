import type { Request, Response, NextFunction } from "../types/index.js";
import { healthService } from "../services/health.service.js";

/**
 * Health Controller.
 * Handles GET /api/health probe requests.
 */
export async function getHealth(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const health = await healthService.getHealth();
    res.status(200).json({
      success: true,
      message: "KumbhMitra server is running",
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export default { getHealth };
