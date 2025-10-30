/**
 * Molam ID - Roles Repository
 * Database operations for role management
 */
import { query, getClient } from './index';
import { RoleDTO, RoleRecord, UserRoleRecord, ApprovalRecord } from '../types';

/**
 * Create or update a role
 */
export async function upsertRole(actorId: string, dto: RoleDTO): Promise<RoleRecord> {
  const sql = `
    INSERT INTO molam_roles_v2 (
      id,
      name,
      role_type,
      module_scope,
      description,
      trusted_level,
      priority,
      is_system
    )
    VALUES (
      COALESCE($1::uuid, gen_random_uuid()),
      $2,
      COALESCE($3, 'internal'),
      $4,
      $5,
      $6,
      COALESCE($7, 0),
      COALESCE($8, false)
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      role_type = EXCLUDED.role_type,
      module_scope = EXCLUDED.module_scope,
      description = EXCLUDED.description,
      trusted_level = EXCLUDED.trusted_level,
      priority = EXCLUDED.priority,
      updated_at = NOW()
    RETURNING *;
  `;

  const { rows } = await query(sql, [
    dto.id ?? null,
    dto.name,
    dto.role_type ?? 'internal',
    dto.module_scope,
    dto.description ?? null,
    dto.trusted_level,
    dto.priority ?? 0,
    dto.is_system ?? false,
  ]);

  return rows[0];
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<RoleRecord | null> {
  const { rows } = await query(
    `SELECT * FROM molam_roles_v2 WHERE id = $1`,
    [roleId]
  );
  return rows[0] || null;
}

/**
 * Get role by name
 */
export async function getRoleByName(name: string): Promise<RoleRecord | null> {
  const { rows } = await query(
    `SELECT * FROM molam_roles_v2 WHERE name = $1`,
    [name]
  );
  return rows[0] || null;
}

/**
 * List all roles with optional filters
 */
export async function listRoles(filters?: {
  module_scope?: string;
  role_type?: string;
}): Promise<RoleRecord[]> {
  let sql = `SELECT * FROM molam_roles_v2 WHERE 1=1`;
  const params: any[] = [];

  if (filters?.module_scope) {
    params.push(filters.module_scope);
    sql += ` AND module_scope = $${params.length}`;
  }

  if (filters?.role_type) {
    params.push(filters.role_type);
    sql += ` AND role_type = $${params.length}`;
  }

  sql += ` ORDER BY trusted_level DESC, name ASC`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Grant a role to a user
 */
export async function addGrant(
  userId: string,
  roleId: string,
  grantedBy: string,
  options?: {
    scopeConstraint?: string;
    expiresAt?: Date;
    justification?: string;
  }
): Promise<UserRoleRecord | null> {
  const sql = `
    INSERT INTO molam_user_roles (
      user_id,
      role_id,
      granted_by,
      scope_constraint,
      expires_at,
      justification
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, role_id) DO NOTHING
    RETURNING *;
  `;

  const { rows } = await query(sql, [
    userId,
    roleId,
    grantedBy,
    options?.scopeConstraint ?? null,
    options?.expiresAt ?? null,
    options?.justification ?? null,
  ]);

  return rows[0] || null; // null if already existed
}

/**
 * Revoke a role from a user
 */
export async function revokeGrant(
  userId: string,
  roleId: string
): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM molam_user_roles WHERE user_id = $1 AND role_id = $2`,
    [userId, roleId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(
  userId: string,
  roleId: string
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM molam_user_roles
     WHERE user_id = $1 AND role_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, roleId]
  );
  return rows.length > 0;
}

/**
 * Get user's roles
 */
export async function getUserRoles(userId: string): Promise<RoleRecord[]> {
  const { rows } = await query(
    `SELECT r.* FROM molam_user_roles ur
     JOIN molam_roles_v2 r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
     ORDER BY r.trusted_level DESC`,
    [userId]
  );
  return rows;
}

/**
 * Create an approval request
 */
export async function createApprovalRequest(
  userId: string,
  roleId: string,
  requestedBy: string,
  justification?: string
): Promise<ApprovalRecord> {
  const sql = `
    INSERT INTO molam_role_grants_approvals (
      request_id,
      user_id,
      role_id,
      requested_by,
      approver_required,
      justification,
      status
    )
    VALUES (gen_random_uuid(), $1, $2, $3, TRUE, $4, 'pending')
    RETURNING *;
  `;

  const { rows } = await query(sql, [
    userId,
    roleId,
    requestedBy,
    justification ?? null,
  ]);

  return rows[0];
}

/**
 * Get approval request by request_id
 */
export async function getApprovalRequest(
  requestId: string
): Promise<ApprovalRecord | null> {
  const { rows } = await query(
    `SELECT * FROM molam_role_grants_approvals WHERE request_id = $1`,
    [requestId]
  );
  return rows[0] || null;
}

/**
 * Update approval request status
 */
export async function updateApprovalStatus(
  requestId: string,
  status: 'approved' | 'rejected' | 'cancelled',
  approvedBy: string,
  reason?: string
): Promise<ApprovalRecord> {
  const sql = `
    UPDATE molam_role_grants_approvals
    SET status = $2,
        approved_by = $3,
        approved_at = NOW(),
        reason = $4,
        updated_at = NOW()
    WHERE request_id = $1
    RETURNING *;
  `;

  const { rows } = await query(sql, [requestId, status, approvedBy, reason ?? null]);
  return rows[0];
}

/**
 * List pending approval requests
 */
export async function listPendingApprovals(filters?: {
  userId?: string;
  requestedBy?: string;
}): Promise<ApprovalRecord[]> {
  let sql = `
    SELECT * FROM molam_role_grants_approvals
    WHERE status = 'pending'
  `;
  const params: any[] = [];

  if (filters?.userId) {
    params.push(filters.userId);
    sql += ` AND user_id = $${params.length}`;
  }

  if (filters?.requestedBy) {
    params.push(filters.requestedBy);
    sql += ` AND requested_by = $${params.length}`;
  }

  sql += ` ORDER BY created_at ASC`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Check if actor can manage scope (calls SQL guard function)
 */
export async function canManageScope(
  actorId: string,
  scope: string
): Promise<boolean> {
  const { rows } = await query(
    `SELECT can_manage_scope($1, $2) AS ok`,
    [actorId, scope]
  );
  return rows[0]?.ok ?? false;
}

/**
 * Check if actor has higher trust level than target role (calls SQL guard function)
 */
export async function hasHigherTrust(
  actorId: string,
  targetRoleId: string
): Promise<boolean> {
  const { rows } = await query(
    `SELECT has_higher_trust($1, $2) AS ok`,
    [actorId, targetRoleId]
  );
  return rows[0]?.ok ?? false;
}

/**
 * Get user's maximum trust level
 */
export async function getUserMaxTrustLevel(userId: string): Promise<number> {
  const { rows } = await query(
    `SELECT COALESCE(MAX(r.trusted_level), 0) AS max_trust
     FROM molam_user_roles ur
     JOIN molam_roles_v2 r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
    [userId]
  );
  return rows[0]?.max_trust ?? 0;
}

/**
 * Audit role operation
 */
export async function auditRoleOperation(
  userId: string,
  roleId: string,
  operation: string,
  actorId: string,
  details?: any
): Promise<void> {
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
      'allow',
      $3,
      $4,
      NOW()
    )`,
    [
      userId,
      `role.${operation}`,
      `role_${operation}_by_${actorId}`,
      JSON.stringify({ role_id: roleId, actor_id: actorId, ...details }),
    ]
  );
}
