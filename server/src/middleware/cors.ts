import type { Request, Response, NextFunction, RequestHandler } from "../types/index.js";
import { config } from "../config/env.js";

/**
 * Robust CORS middleware that supports wildcard (*), single origin,
 * or an array of allowed origins from configuration.
 */
export function corsMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const allowed = config.corsOrigin;

    if (allowed.includes("*") && allowed.length === 1 && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
      // Only allow literal * in development/test, never production
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (!origin || allowed.length === 0) {
      // No origin header OR no configured origins → do not send CORS header
      // (safe default: do not expose to unexpected clients)
    } else if (allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}

export default corsMiddleware;
