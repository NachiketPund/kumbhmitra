import { adminService } from "../services/admin.service.js";
import type { Request, Response, NextFunction } from "../types/index.js";

export const adminController = {
  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const s = await adminService.stats();
      res.json({ success: true, data: s });
    } catch (e) { next(e); }
  },

  listUsers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);
      const rows = await adminService.listUsers(limit, offset);
      res.json({ success: true, data: rows });
    } catch (e) { next(e); }
  },

  updateUserRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { role } = req.body || {};
      const row = await adminService.setUserRole(userId, role);
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },

  setUserActive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body || {};
      const row = await adminService.setUserActive(userId, Boolean(isActive));
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },

  approveLostFound: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const row = await adminService.setLostFoundStatus(id, "resolved");
      res.json({ success: true, data: row, note: "Admin-approved." });
    } catch (e) { next(e); }
  },

  rejectLostFound: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const row = await adminService.setLostFoundStatus(id, "expired");
      res.json({ success: true, data: row, note: "Admin-rejected." });
    } catch (e) { next(e); }
  },
};
