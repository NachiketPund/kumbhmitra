import { AppError } from './errorHandler.js';
import type { Request, Response, NextFunction } from '../types/index.js';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new AppError('Admin access required — not authenticated.', 401, 'UNAUTHORIZED'));
  if (req.user.role !== 'ADMIN') return next(new AppError('Admin access required — role is USER.', 403, 'FORBIDDEN'));
  next();
}
