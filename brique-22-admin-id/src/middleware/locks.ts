/**
 * Molam ID - Emergency Locks Middleware
 * Checks for active emergency locks and denies access if locked
 */
import { Request, Response, NextFunction } from 'express';
import { isLocked } from '../admin/repo';

/**
 * Middleware to check if access is blocked by emergency lock
 */
export async function checkEmergencyLocks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract context from request
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] as string;
    const moduleScope = req.headers['x-module-scope'] as string;
    const roleIds: string[] = []; // Would be populated from user's roles

    // Check if locked
    const locked = await isLocked(tenantId, moduleScope, roleIds);

    if (locked) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'This service is temporarily locked by an administrator',
        code: 'emergency_lock_active',
      });
      return;
    }

    next();
  } catch (err) {
    console.error('Error checking emergency locks:', err);
    // Don't block on errors - fail open for availability
    next();
  }
}

/**
 * Deny access if locked for specific context
 */
export async function denyIfLocked(ctx: {
  tenant_id?: string;
  module_scope?: string;
  role_ids?: string[];
}): Promise<boolean> {
  try {
    return await isLocked(ctx.tenant_id, ctx.module_scope, ctx.role_ids);
  } catch (err) {
    console.error('Error in denyIfLocked:', err);
    return false; // Fail open
  }
}
