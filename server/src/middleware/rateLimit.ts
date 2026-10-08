/**
 * Basic in-memory rate limiter (no external deps).
 * Per-IP sliding window: max 60 requests per 60s, 10 auth attempts per 60s.
 * Production should replace with Redis-backed limiter (e.g. express-rate-limit + redis).
 */
import type { Request, Response, NextFunction } from "../types/index.js";
import { AppError } from "./errorHandler.js";

interface Window { count: number; resetAt: number; }

const windows = new Map<string, Window>();
const MAX_REQ = 60;  // per minute per IP
const MAX_AUTH = 10; // per minute per IP for auth paths
const WINDOW_MS = 60_000;

function key(req: Request, suffix = "default"): string {
  return `${req.ip ?? "unknown"}:${req.method}:${req.path || "/"}:${suffix}`;
}

function check(key: string, max: number): void {
  const now = Date.now();
  let w = windows.get(key);
  if (!w || now > w.resetAt) { w = { count: 0, resetAt: now + WINDOW_MS }; windows.set(key, w); }
  w.count += 1;
  if (w.count > max) {
    throw new AppError("Rate limit exceeded. Try again shortly.", 429, "RATE_LIMITED");
  }
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  try {
    const isAuthPath = (req.path || "").startsWith("/auth") || (req.path || "").startsWith("/api/auth");
    check(key(req, isAuthPath ? "auth" : "default"), isAuthPath ? MAX_AUTH : MAX_REQ);
    next();
  } catch (e) { next(e); }
}

export default rateLimit;
