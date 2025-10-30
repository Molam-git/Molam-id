/**
 * Molam ID - RBAC Middleware
 * Enforces permission checks on routes
 */
import { Request, Response, NextFunction } from 'express';
import { checkPermission, checkAnyPermission, checkAllPermissions } from '../util/rbac';

/**
 * Middleware to require a specific permission
 */
export function requirePermission(permCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.sub) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const allowed = await checkPermission(req.user.sub, permCode, {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
    });

    if (!allowed) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied: ${permCode}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require any of the specified permissions
 */
export function requireAnyPermission(permCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.sub) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const allowed = await checkAnyPermission(req.user.sub, permCodes, {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
    });

    if (!allowed) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied. Required any of: ${permCodes.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require all of the specified permissions
 */
export function requireAllPermissions(permCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.sub) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const allowed = await checkAllPermissions(req.user.sub, permCodes, {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
    });

    if (!allowed) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied. Required all of: ${permCodes.join(', ')}`,
      });
      return;
    }

    next();
  };
}
