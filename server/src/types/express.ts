import type { IncomingMessage, ServerResponse } from "http";

export interface AuthUser {
  /** Supabase Auth user ID (UUID from auth.users) */
  id: string;
  email?: string;
  /** Our internal users table row ID (same UUID as auth_id) */
  dbUserId?: string;
}

export interface Request extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body: any;
  path: string;
  originalUrl: string;
  ip?: string;
  headers: IncomingMessage["headers"];
  method?: string;
  /** Set by requireAuth / optionalAuth middleware */
  user?: AuthUser & { role?: 'USER' | 'ADMIN' };
}

export interface Response extends ServerResponse {
  status(code: number): this;
  json(data: any): this;
  send(data: any): this;
  sendStatus(code: number): this;
  set(field: string, value: string | string[]): this;
  header(field: string, value: string | string[]): this;
}

export type NextFunction = (err?: any) => void;

export type RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type Middleware = RequestHandler | ErrorRequestHandler;
