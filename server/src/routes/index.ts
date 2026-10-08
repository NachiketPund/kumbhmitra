import { Router } from "../core/express.js";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import lostFoundRoutes from "./lost-found.routes.js";
import placesRoutes from "./places.routes.js";
import emergencyRoutes from "./emergency.routes.js";
import crowdRoutes from "./crowd.routes.js";
import adminRoutes from "./admin.routes.js";

const apiRouter = Router();

// GET /api/health
apiRouter.use("/health", healthRoutes);

// Auth routes: /api/auth
apiRouter.use("/auth", authRoutes);

// /api/lost-found  (GET, POST, GET/:id, PUT/:id, DELETE/:id)
apiRouter.use("/lost-found", lostFoundRoutes);

// /api/places  (GET /, GET /nearby, GET /:id)
apiRouter.use("/places", placesRoutes);

// /api/emergency  (GET /contacts, GET /contacts/:id, POST /sos)
apiRouter.use("/emergency", emergencyRoutes);

// /api/crowd  (GET /, GET /:placeId, PATCH /:placeId)
apiRouter.use("/crowd", crowdRoutes);
apiRouter.use("/admin", adminRoutes);

export default apiRouter;
