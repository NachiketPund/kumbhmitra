import { Router } from "../core/express.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { adminController } from "../controllers/admin.controller.js";

const router = Router();

// All admin endpoints: auth first, then admin role check
router.use(requireAuth);
router.use(requireAdmin);

router.get("/stats", adminController.stats);
router.get("/users", adminController.listUsers);
router.patch("/users/:userId/role", adminController.updateUserRole);
router.patch("/users/:userId/active", adminController.setUserActive);
router.post("/lost-found/:id/approve", adminController.approveLostFound);
router.post("/lost-found/:id/reject", adminController.rejectLostFound);

export default router;
