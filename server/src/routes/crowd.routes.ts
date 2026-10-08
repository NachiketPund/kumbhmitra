/**
 * Crowd Routes
 * Mounted at /api/crowd in routes/index.ts
 *
 * Public: GET /, GET /:placeId
 * Admin: PATCH /:placeId (requires auth — wire with requireAuth when needed)
 */
import { Router } from "../core/express.js";
import { listCrowd, getCrowdByPlace, updateCrowd } from "../controllers/crowd.controller.js";

const router = Router();

router.get("/", listCrowd);
router.get("/:placeId", getCrowdByPlace);
router.patch("/:placeId", updateCrowd); // Admin — add requireAuth middleware here when auth roles are finalised

export default router;
