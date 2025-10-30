/**
 * RBAC Permission Checker
 * Core logic for checking user permissions
 */

import { query } from "../util/pg";
import { getCachedPermissions, cachePermissions } from "../util/cache";

export interface PermissionContext {
  path?: string;
  method?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  [key: string]: any;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  roles?: string[];
  matched_permission?: string;
}

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
    const cached = await getCachedPermissions(userId);
    if (cached && cached.includes(permCode)) {
      await auditDecision(userId, permCode, "allow", "cached", context);
      return true;
    }

    // Query database
    const result = await query(
      `SELECT 1
       FROM molam_user_roles ur
       JOIN molam_role_permissions rp ON ur.role_id = rp.role_id
       JOIN molam_permissions p ON rp.perm_id = p.id
       WHERE ur.user_id = $1
         AND p.code = $2
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       LIMIT 1`,
      [userId, permCode]
    );

    const allowed = result.rows.length > 0;

    // Audit decision
    await auditDecision(
      userId,
      permCode,
      allowed ? "allow" : "deny",
      allowed ? "permission_found" : "permission_not_found",
      context
    );

    // Update cache on success
    if (allowed && !cached) {
      const permissions = await getUserPermissions(userId);
      await cachePermissions(userId, permissions);
    }

    return allowed;
  } catch (error) {
    console.error("Permission check error:", error);
    await auditDecision(userId, permCode, "deny", "error", context);
    return false;
  }
}

/**
 * Check if user has detailed permission (returns full result)
 */
export async function checkPermissionDetailed(
  userId: string,
  permCode: string,
  context: PermissionContext = {}
): Promise<PermissionCheckResult> {
  try {
    // Query with role information
    const result = await query(
      `SELECT
         r.name as role_name,
         p.code as perm_code
       FROM molam_user_roles ur
       JOIN molam_roles_v2 r ON ur.role_id = r.id
       JOIN molam_role_permissions rp ON r.id = rp.role_id
       JOIN molam_permissions p ON rp.perm_id = p.id
       WHERE ur.user_id = $1
         AND p.code = $2
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId, permCode]
    );

    const allowed = result.rows.length > 0;
    const roles = result.rows.map((row) => row.role_name);

    const checkResult: PermissionCheckResult = {
      allowed,
      roles,
      matched_permission: allowed ? permCode : undefined,
      reason: allowed ? "permission_granted" : "permission_denied",
    };

    // Audit decision
    await auditDecision(
      userId,
      permCode,
      allowed ? "allow" : "deny",
      checkResult.reason!,
      context
    );

    return checkResult;
  } catch (error) {
    console.error("Permission check error:", error);
    await auditDecision(userId, permCode, "deny", "error", context);

    return {
      allowed: false,
      reason: "internal_error",
    };
  }
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function checkAnyPermission(
  userId: string,
  permCodes: string[],
  context: PermissionContext = {}
): Promise<boolean> {
  for (const permCode of permCodes) {
    const allowed = await checkPermission(userId, permCode, context);
    if (allowed) return true;
  }
  return false;
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function checkAllPermissions(
  userId: string,
  permCodes: string[],
  context: PermissionContext = {}
): Promise<boolean> {
  for (const permCode of permCodes) {
    const allowed = await checkPermission(userId, permCode, context);
    if (!allowed) return false;
  }
  return true;
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const result = await query(
    `SELECT DISTINCT p.code
     FROM molam_user_roles ur
     JOIN molam_role_permissions rp ON ur.role_id = rp.role_id
     JOIN molam_permissions p ON rp.perm_id = p.id
     WHERE ur.user_id = $1
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
     ORDER BY p.code`,
    [userId]
  );

  return result.rows.map((row) => row.code);
}

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string): Promise<any[]> {
  const result = await query(
    `SELECT
       r.id,
       r.name,
       r.display_name,
       r.role_type,
       r.module_scope,
       r.priority,
       ur.scope_constraint,
       ur.expires_at
     FROM molam_user_roles ur
     JOIN molam_roles_v2 r ON ur.role_id = r.id
     WHERE ur.user_id = $1
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
     ORDER BY r.priority DESC, r.name`,
    [userId]
  );

  return result.rows;
}

/**
 * Grant role to user
 */
export async function grantRole(
  userId: string,
  roleName: string,
  grantedBy: string,
  options: {
    scopeConstraint?: string;
    expiresAt?: Date;
    justification?: string;
  } = {}
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT grant_role($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        roleName,
        grantedBy,
        options.scopeConstraint || null,
        options.expiresAt || null,
        options.justification || null,
      ]
    );

    // Invalidate cache
    await getCachedPermissions(userId); // This will trigger cache invalidation

    return result.rows[0]?.grant_role === true;
  } catch (error) {
    console.error("Grant role error:", error);
    return false;
  }
}

/**
 * Revoke role from user
 */
export async function revokeRole(
  userId: string,
  roleName: string
): Promise<boolean> {
  try {
    const result = await query(`SELECT revoke_role($1, $2)`, [
      userId,
      roleName,
    ]);

    // Invalidate cache
    await getCachedPermissions(userId); // This will trigger cache invalidation

    return result.rows[0]?.revoke_role === true;
  } catch (error) {
    console.error("Revoke role error:", error);
    return false;
  }
}

/**
 * Audit RBAC decision
 */
async function auditDecision(
  userId: string,
  permCode: string,
  decision: "allow" | "deny",
  reason: string,
  context: PermissionContext
): Promise<void> {
  try {
    await query(
      `INSERT INTO molam_rbac_audit (
         user_id, perm_code, decision, reason, context, ip_address, user_agent
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        permCode,
        decision,
        reason,
        JSON.stringify(context),
        context.ip_address || null,
        context.user_agent || null,
      ]
    );
  } catch (error) {
    // Don't fail on audit errors, just log
    console.error("Audit error:", error);
  }
}

/**
 * Get RBAC statistics
 */
export async function getRbacStats(): Promise<any> {
  const result = await query(`SELECT * FROM get_rbac_stats()`);
  return result.rows[0] || {};
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM molam_user_roles ur
     JOIN molam_roles_v2 r ON ur.role_id = r.id
     WHERE ur.user_id = $1
       AND r.name = $2
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
     LIMIT 1`,
    [userId, roleName]
  );

  return result.rows.length > 0;
}
