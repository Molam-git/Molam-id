// api/src/middleware/authz.ts
// Authorization middleware (policy enforcement)

import { Request, Response, NextFunction } from 'express';

/**
 * Authorization middleware that checks if user has required permission
 * Integrates with Brique 9 (RBAC & AuthZ) and Brique 21 (Role Management)
 */
export function authzEnforce(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user has the required permission
    const hasPermission = req.user.permissions?.includes(permission) || false;

    if (!hasPermission) {
      // Check if permission is a self-scoped action (e.g., id:profile:read)
      // Self-scoped actions are always allowed for the user's own resources
      const isSelfScoped = permission.startsWith('id:') &&
        (permission.includes(':read') || permission.includes(':update'));

      if (!isSelfScoped) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Missing permission: ${permission}`
        });
        return;
      }
    }

    next();
  };
}

/**
 * Check if user has ANY of the provided permissions
 */
export function authzEnforceAny(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasAnyPermission = permissions.some(
      p => req.user!.permissions?.includes(p)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing one of: ${permissions.join(', ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Check if user has ALL of the provided permissions
 */
export function authzEnforceAll(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasAllPermissions = permissions.every(
      p => req.user!.permissions?.includes(p)
    );

    if (!hasAllPermissions) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing permissions: ${permissions.join(', ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Check if user type matches
 */
export function requireUserType(userType: 'external' | 'internal') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.user_type !== userType) {
      res.status(403).json({
        error: 'Forbidden',
        message: `User type must be: ${userType}`
      });
      return;
    }

    next();
  };
}
