/**
 * Emergency Routes
 * Mounted at /api/emergency in routes/index.ts
 */
import { Router } from "../core/express.js";
import {
  listContacts,
  getContact,
  createSos,
} from "../controllers/emergency.controller.js";

const router = Router();

router.get("/contacts", listContacts);
router.get("/contacts/:id", getContact);
router.post("/sos", createSos);

export default router;
