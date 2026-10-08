import type { Request, Response, NextFunction } from "../types/index.js";
import { config } from "../config/env.js";

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Secure global error handler middleware.
 * Formats errors consistently, scrubs sensitive internal details in production,
 * and ensures no unhandled exception crashes the server.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";
  const isProduction = config.nodeEnv === "production";

  const message =
    isProduction && statusCode === 500
      ? "An unexpected server error occurred."
      : err.message || "Unknown error";

  // Securely log server-side error
  console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${req.url}:`, {
    status: statusCode,
    code: errorCode,
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    details: err.details,
  });

  if (!res.headersSent) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: errorCode,
          message,
          ...(err.details ? { details: err.details } : {}),
          // Stack traces must never reach production clients
          ...(process.env.NODE_ENV === "development" && !isProduction && err.stack ? { stack: err.stack } : {}),
        },
        timestamp: new Date().toISOString(),
      })
    );
  }
}

export default errorHandler;
