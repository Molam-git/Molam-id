/**
 * Authorization middleware
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './jwt';

/**
 * Enforce authorization role
 */
export function authzEnforce(requiredRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const roles = req.user.roles || [];
    const hasRole = roles.some((r: any) => {
      if (typeof r === 'string') return r === requiredRole;
      if (r.module && r.role) return `${r.module}:${r.role}` === requiredRole;
      return false;
    });

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${requiredRole}`,
      });
    }

    next();
  };
}
