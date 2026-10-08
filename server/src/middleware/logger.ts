import type { Request, Response, NextFunction } from "../types/index.js";

/**
 * Clean HTTP request logger middleware.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const url = req.url || "/";
  const method = req.method || "GET";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logPrefix = statusCode >= 400 ? "[WARN]" : "[INFO]";
    console.log(
      `${logPrefix} ${new Date().toISOString()} | ${method} ${url} | ${statusCode} | ${duration}ms`
    );
  });

  next();
}

export default requestLogger;
