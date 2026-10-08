import { Router } from "../core/express.js";
import { getHealth } from "../controllers/health.controller.js";

const router = Router();

// GET /api/health
router.get("/", getHealth);

export default router;
