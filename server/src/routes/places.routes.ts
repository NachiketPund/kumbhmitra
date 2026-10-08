/**
 * Places Routes
 * Mounted at /api/places in routes/index.ts
 *
 * Public read-only endpoints:
 *   GET /api/places         — list (filter by category, search, paginate)
 *   GET /api/places/nearby  — nearest places to a lat/lng
 *   GET /api/places/:id     — single place
 *
 * IMPORTANT: /nearby is registered before /:id so the literal segment
 * "nearby" is not mistaken for an id parameter.
 */
import { Router } from "../core/express.js";
import {
  listPlaces,
  getNearbyPlaces,
  getPlace,
} from "../controllers/places.controller.js";

const router = Router();

router.get("/", listPlaces);
router.get("/nearby", getNearbyPlaces);
router.get("/:id", getPlace);

export default router;
