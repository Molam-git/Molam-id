/**
 * Molam ID - RBAC Permission Check Utility
 * Simplified version for role management service
 * In production, this would be imported from Brique 20
 */
import { query } from '../repo';
import { getRedis } from '../repo/redis';
import { PermissionContext } from '../types';

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  userId: string,
  permCode: string,
  context: PermissionContext = {}
): Promise<boolean> {
  try {
    // Try cache first
    const redis = getRedis();
    const cacheKey = `rbac:user:${userId}:perms`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const perms = JSON.parse(cached);
      if (perms.includes(permCode) || perms.includes('*')) {
        await auditDecision(userId, permCode, 'allow', 'cached', context);
        return true;
      }
    }

    // Query database
    const result = await query(
      `SELECT DISTINCT p.code
       FROM molam_user_roles ur
       JOIN molam_role_permissions rp ON rp.role_id = ur.role_id
       JOIN molam_permissions p ON p.id = rp.perm_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         AND (p.code = $2 OR p.code = '*')`,
      [userId, permCode]
    );

    const allowed = result.rows.length > 0;

    // Audit decision
    await auditDecision(
      userId,
      permCode,
      allowed ? 'allow' : 'deny',
      allowed ? 'permission_granted' : 'permission_denied',
      context
    );

    // Cache user permissions if not cached
    if (!cached && allowed) {
      const allPerms = await query(
        `SELECT DISTINCT p.code
         FROM molam_user_roles ur
         JOIN molam_role_permissions rp ON rp.role_id = ur.role_id
         JOIN molam_permissions p ON p.id = rp.perm_id
         WHERE ur.user_id = $1
           AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
        [userId]
      );
      const permCodes = allPerms.rows.map((r) => r.code);
      await redis.setEx(cacheKey, 600, JSON.stringify(permCodes)); // 10 min TTL
    }

    return allowed;
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}

/**
 * Audit RBAC decision
 */
async function auditDecision(
  userId: string,
  permCode: string,
  decision: 'allow' | 'deny',
  reason: string,
  context: PermissionContext
): Promise<void> {
  try {
    await query(
      `INSERT INTO molam_rbac_audit (
        id,
        user_id,
        permission_code,
        decision,
        reason,
        ctx,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW()
      )`,
      [userId, permCode, decision, reason, JSON.stringify(context)]
    );
  } catch (err) {
    console.error('Failed to audit decision:', err);
    // Don't throw - auditing failures shouldn't break operations
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function checkAnyPermission(
  userId: string,
  permCodes: string[],
  context: PermissionContext = {}
): Promise<boolean> {
  for (const permCode of permCodes) {
    if (await checkPermission(userId, permCode, context)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all of the specified permissions
 */
export async function checkAllPermissions(
  userId: string,
  permCodes: string[],
  context: PermissionContext = {}
): Promise<boolean> {
  for (const permCode of permCodes) {
    if (!(await checkPermission(userId, permCode, context))) {
      return false;
    }
  }
  return true;
}
