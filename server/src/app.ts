import { express } from "./core/express.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler, AppError } from "./middleware/errorHandler.js";
import apiRouter from "./routes/index.js";
import type { Request, Response, NextFunction } from "./types/index.js";

import { rateLimit } from "./middleware/rateLimit.js";

export function createApp() {
  const app = express();

  // Attach global middleware (rate limit before routes)
  app.use(rateLimit);
  app.use(corsMiddleware());
  app.use(requestLogger);
  app.use(express.json());
  app.use(express.urlencoded());

  // Mount API master router
  app.use("/api", apiRouter);

  // Fallback 404 handler for undefined endpoints
  app.use("*", (req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        `Cannot ${req.method} ${req.originalUrl || req.path} on this server`,
        404,
        "NOT_FOUND"
      )
    );
  });

  // Global secure error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
