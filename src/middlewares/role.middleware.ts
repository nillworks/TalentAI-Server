import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.d.js';

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access forbidden — insufficient role' });
      return;
    }
    next();
  };
};
