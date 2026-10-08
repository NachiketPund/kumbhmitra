/**
 * Lost & Found Routes
 * Mounted at /api/lost-found in routes/index.ts
 *
 * Auth policy:
 *  GET  / and GET /:id  — public (optionalAuth attaches user if logged in)
 *  POST /               — requires auth (report is linked to the user)
 *  PUT  /:id            — requires auth (only the owner can edit)
 *  DELETE /:id          — requires auth (only the owner can delete)
 */
import { Router } from "../core/express.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import {
  listLostFound,
  getLostFound,
  createLostFound,
  updateLostFound,
  deleteLostFound,
} from "../controllers/lost-found.controller.js";

const router = Router();

// Public reads — optionalAuth so req.user is available if logged in
router.get("/", optionalAuth, listLostFound);
router.get("/:id", optionalAuth, getLostFound);

// Protected writes — user must be authenticated
router.post("/", requireAuth, createLostFound);
router.put("/:id", requireAuth, updateLostFound);
router.delete("/:id", requireAuth, deleteLostFound);

export default router;
