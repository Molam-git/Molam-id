/**
 * RBAC Middleware
 * Express middleware for permission checking
 */

import { Request, Response, NextFunction } from "express";
import { checkPermission, checkAnyPermission, checkAllPermissions, hasRole } from "../rbac/check";

/**
 * Require specific permission
 */
export function requirePermission(permCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    const context = {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    };

    const allowed = await checkPermission(userId, permCode, context);

    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Permission denied: ${permCode}`,
        required_permission: permCode,
      });
    }

    next();
  };
}

/**
 * Require ANY of the specified permissions
 */
export function requireAnyPermission(permCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    const context = {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    };

    const allowed = await checkAnyPermission(userId, permCodes, context);

    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Permission denied",
        required_permissions: permCodes,
        requirement: "any",
      });
    }

    next();
  };
}

/**
 * Require ALL of the specified permissions
 */
export function requireAllPermissions(permCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    const context = {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    };

    const allowed = await checkAllPermissions(userId, permCodes, context);

    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Permission denied",
        required_permissions: permCodes,
        requirement: "all",
      });
    }

    next();
  };
}

/**
 * Require specific role
 */
export function requireRole(roleName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    const hasRoleResult = await hasRole(userId, roleName);

    if (!hasRoleResult) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Role required: ${roleName}`,
        required_role: roleName,
      });
    }

    next();
  };
}

/**
 * Optionally check permission (doesn't fail, just sets req.hasPermission)
 */
export function optionalPermission(permCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;

    if (!userId) {
      (req as any).hasPermission = false;
      return next();
    }

    const context = {
      path: req.path,
      method: req.method,
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    };

    const allowed = await checkPermission(userId, permCode, context);
    (req as any).hasPermission = allowed;

    next();
  };
}
