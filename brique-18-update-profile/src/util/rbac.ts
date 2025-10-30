/**
 * RBAC Utilities for Profile Updates
 * Supports subsidiary-scoped permissions
 */

import { RequestHandler } from "express";

export interface AuthUser {
  user_id: string;
  molam_id: string;
  role: string;
  scopes: string[];
  subsidiary?: string;
  employee?: boolean;
}

/**
 * Check if user is an employee with subsidiary scope
 */
export function isSubsidiaryScopedAdmin(user: AuthUser): boolean {
  return (
    user.employee === true &&
    Array.isArray(user.scopes) &&
    user.scopes.some((s) => s.startsWith("subsidiary:"))
  );
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  if (!Array.isArray(user.scopes)) return false;

  // Check for exact match or wildcard
  return user.scopes.some(
    (scope) => scope === permission || scope === permission.split(":")[0] + ":*"
  );
}

/**
 * Check if user can update another user's profile
 *
 * Rules:
 * - Users can always update their own profile
 * - Admins with id:profile:update:any can update anyone
 * - Admins with id:profile:update:subsidiary:XXX can update users in their subsidiary
 */
export function canUpdateProfile(
  actor: AuthUser,
  targetUserId: string,
  targetSubsidiary?: string
): boolean {
  // Self-update always allowed
  if (actor.user_id === targetUserId) return true;

  // Global admin
  if (hasPermission(actor, "id:profile:update:any")) return true;

  // Subsidiary-scoped admin
  if (
    targetSubsidiary &&
    hasPermission(actor, `id:profile:update:subsidiary:${targetSubsidiary}`)
  ) {
    return true;
  }

  return false;
}

/**
 * Assert that user can update profile (throws 403 if not)
 */
export function assertCanUpdateProfile(
  actor: AuthUser,
  targetUserId: string,
  targetSubsidiary?: string
): void {
  if (!canUpdateProfile(actor, targetUserId, targetSubsidiary)) {
    throw new ForbiddenError(
      "You do not have permission to update this profile"
    );
  }
}

/**
 * Get user's subsidiary from database
 */
export async function getUserSubsidiary(
  userId: string,
  db: any
): Promise<string | null> {
  const result = await db.query(
    `
    SELECT p.subsidiary
    FROM molam_profiles p
    WHERE p.user_id = $1
  `,
    [userId]
  );

  return result.rows[0]?.subsidiary || null;
}

/**
 * Middleware: Require authentication
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }
  next();
};

/**
 * Middleware: Require specific permission
 */
export function requirePermission(permission: string): RequestHandler {
  return (req, res, next) => {
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!hasPermission(user, permission)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Permission denied: ${permission}`,
      });
    }

    next();
  };
}

/**
 * Middleware: Require employee role
 */
export const requireEmployee: RequestHandler = (req, res, next) => {
  const user = req.user as AuthUser;

  if (!user?.employee) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Employee access required",
    });
  }

  next();
};

/**
 * Custom error classes
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Extract subsidiary scope from user scopes
 *
 * @example
 * extractSubsidiaryScopes(["subsidiary:PAY", "subsidiary:EATS"])
 * // => ["PAY", "EATS"]
 */
export function extractSubsidiaryScopes(scopes: string[]): string[] {
  return scopes
    .filter((s) => s.startsWith("subsidiary:"))
    .map((s) => s.replace("subsidiary:", ""));
}

/**
 * Check if user has access to a specific subsidiary
 */
export function hasSubsidiaryAccess(
  user: AuthUser,
  subsidiary: string
): boolean {
  const subsidiaries = extractSubsidiaryScopes(user.scopes || []);
  return subsidiaries.includes(subsidiary);
}
