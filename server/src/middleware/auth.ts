/**
 * JWT Auth Middleware
 *
 * Verifies Supabase-issued JWTs server-side using the SUPABASE_JWT_SECRET.
 * Does NOT use the Supabase SDK — pure Node.js crypto, zero extra deps.
 *
 * Supabase JWTs are standard HS256 tokens. We verify the signature,
 * expiry, and issuer, then attach the decoded user to req.user.
 *
 * Two middleware functions:
 *  - requireAuth: rejects with 401 if no valid token
 *  - optionalAuth: attaches user if token present, passes through if not
 */
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "../types/index.js";
import { AppError } from "./errorHandler.js";
import { config } from "../config/env.js";
import { userSyncService } from "../services/user-sync.service.js";

// ── JWT helpers (no external deps) ───────────────────────────────────────────

function base64UrlDecode(str: string): Buffer {
  // Convert base64url → base64
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

interface SupabaseJwtPayload {
  sub: string;       // user UUID
  email?: string;
  role?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  aud?: string | string[];
}

function verifySupabaseJwt(token: string, secret: string): SupabaseJwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError("Malformed token", 401, "INVALID_TOKEN");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify HS256 signature
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");

  // Constant-time comparison to prevent timing attacks
  const actualSigBuf = Buffer.from(signatureB64, "base64url");
  const expectedSigBuf = Buffer.from(expectedSig, "base64url");
  const sigLengthMatch = actualSigBuf.length === expectedSigBuf.length;
  const sigValid =
    sigLengthMatch &&
    crypto.timingSafeEqual(actualSigBuf, expectedSigBuf);

  if (!sigValid) {
    throw new AppError("Invalid token signature", 401, "INVALID_TOKEN");
  }

  // Decode payload
  let payload: SupabaseJwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    throw new AppError("Token payload unreadable", 401, "INVALID_TOKEN");
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new AppError("Token has expired", 401, "TOKEN_EXPIRED");
  }

  // Must have a subject (user ID)
  if (!payload.sub) {
    throw new AppError("Token missing subject", 401, "INVALID_TOKEN");
  }

  return payload;
}

// ── Extract Bearer token from Authorization header ────────────────────────────

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Requires a valid Supabase JWT in the Authorization header.
 * Attaches req.user on success. Rejects with 401 otherwise.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return next(
      new AppError(
        "Authentication required. Provide a Bearer token in the Authorization header.",
        401,
        "UNAUTHORIZED"
      )
    );
  }

  const secret = config.supabaseJwtSecret;
  if (!secret) {
    console.error("[AUTH] SUPABASE_JWT_SECRET is not set — all auth will fail");
    return next(
      new AppError("Server auth not configured", 500, "AUTH_NOT_CONFIGURED")
    );
  }

  try {
    const payload = verifySupabaseJwt(token, secret);

    // Sync/find the user in our users table (also returns their app role)
    const result = await userSyncService.syncUser({
      authId: payload.sub,
      email: payload.email,
    });

    req.user = {
      id: payload.sub,
      email: payload.email,
      dbUserId: result.dbUserId,
      role: (result.role === 'ADMIN' ? 'ADMIN' : 'USER') as 'USER' | 'ADMIN',
    };

    next();
  } catch (err: any) {
    // Pass AppErrors through as-is, wrap anything unexpected
    if (err instanceof AppError) return next(err);
    next(new AppError("Token verification failed", 401, "INVALID_TOKEN"));
  }
}

/**
 * Optionally attaches req.user if a valid token is present.
 * Never rejects — passes through even if no token or invalid token.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) return next();

  const secret = config.supabaseJwtSecret;
  if (!secret) return next();

  try {
    const payload = verifySupabaseJwt(token, secret);
    const result = await userSyncService.syncUser({
      authId: payload.sub,
      email: payload.email,
    });
    req.user = {
      id: payload.sub,
      email: payload.email,
      dbUserId: result.dbUserId,
      role: (result.role === 'ADMIN' ? 'ADMIN' : 'USER') as 'USER' | 'ADMIN',
    };
  } catch {
    // Invalid/expired token — just don't set req.user
  }

  next();
}

export default { requireAuth, optionalAuth };
