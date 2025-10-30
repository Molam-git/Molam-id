// brique-32-api-role-mgmt/api/src/services/role-management.service.ts
// Service layer for role management operations

import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import {
  AssignRoleRequest,
  RevokeRoleRequest,
  SearchUsersRequest,
  AuditQuery,
  BulkAssignRequest,
  BulkRevokeRequest
} from '../validators/rbac.schemas';

// =====================================================
// TYPES
// =====================================================

export type Module = 'pay' | 'eats' | 'shop' | 'talk' | 'ads' | 'free' | 'id' | 'global';
export type AccessScope = 'read' | 'write' | 'admin' | 'owner';

export interface UserRole {
  user_role_id: string;
  user_id: string;
  role_key: string;
  role_name?: string;
  module: Module;
  access_scope: AccessScope;
  trusted_level: number;
  assigned_at: Date;
  assigned_by: string;
  expires_at?: Date;
  delegated_by?: string;
  delegation_reason?: string;
  approval_status: string;
  is_active: boolean;
  status?: string;
}

export interface UserRoleSearch {
  user_id: string;
  email: string;
  phone_e164?: string;
  full_name?: string;
  module: Module;
  role_key: string;
  role_name: string;
  access_scope: AccessScope;
  trusted_level: number;
  expires_at?: Date;
  delegated_by?: string;
  delegation_reason?: string;
}

export interface RoleAudit {
  audit_id: string;
  performed_by: string;
  target_user: string;
  action: string;
  module: Module;
  role_key: string;
  previous_state?: any;
  new_state?: any;
  reason?: string;
  delegation_reason?: string;
  ip_address?: string;
  user_agent?: string;
  performed_at: Date;
}

export interface RoleStatistics {
  module: Module;
  role_key: string;
  role_name: string;
  total_users: number;
  delegated_count: number;
  expiring_soon: number;
}

export interface AssignRoleMetadata {
  ip_address?: string;
  user_agent?: string;
  idempotency_key?: string;
}

// =====================================================
// ERRORS
// =====================================================

export class RoleManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
    public context?: any
  ) {
    super(message);
    this.name = 'RoleManagementError';
  }
}

export class PermissionDeniedError extends RoleManagementError {
  constructor(message: string, context?: any) {
    super(message, 'PERMISSION_DENIED', 403, context);
    this.name = 'PermissionDeniedError';
  }
}

export class RoleNotFoundError extends RoleManagementError {
  constructor(roleKey: string) {
    super(`Role not found: ${roleKey}`, 'ROLE_NOT_FOUND', 404);
    this.name = 'RoleNotFoundError';
  }
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class RoleManagementService {
  constructor(private pool: Pool) {}

  /**
   * List all roles for a user
   */
  async listUserRoles(
    userId: string,
    options: { includeExpired?: boolean; module?: Module } = {}
  ): Promise<UserRole[]> {
    const { includeExpired = false, module } = options;

    let query: string;
    const params: any[] = [userId];

    if (includeExpired) {
      query = `
        SELECT
          r.*,
          rd.role_name,
          CASE
            WHEN r.revoked_at IS NOT NULL THEN 'revoked'
            WHEN r.expires_at IS NOT NULL AND r.expires_at <= NOW() THEN 'expired'
            WHEN r.approval_status = 'pending' THEN 'pending'
            WHEN r.approval_status = 'rejected' THEN 'rejected'
            ELSE 'active'
          END AS status
        FROM molam_user_roles r
        JOIN molam_role_definitions rd ON r.role_key = rd.role_key
        WHERE r.user_id = $1
      `;
    } else {
      query = `
        SELECT * FROM mv_effective_user_roles
        WHERE user_id = $1
      `;
    }

    if (module) {
      params.push(module);
      query += ` AND module = $${params.length}`;
    }

    query += ` ORDER BY module, role_key`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Check if caller can manage roles in a module
   */
  async ensureCallerCanManage(
    callerId: string,
    module: Module
  ): Promise<{ isSuperadmin: boolean }> {
    // Check if user is superadmin
    const superadminCheck = await this.pool.query(
      `SELECT 1 FROM mv_effective_user_roles
       WHERE user_id = $1 AND module = 'id' AND role_key = 'superadmin'
       LIMIT 1`,
      [callerId]
    );

    if (superadminCheck.rows.length > 0) {
      return { isSuperadmin: true };
    }

    // Check if user is admin in the same module
    const adminCheck = await this.pool.query(
      `SELECT 1 FROM mv_effective_user_roles
       WHERE user_id = $1 AND module = $2
       AND (role_key = 'admin' OR access_scope = 'admin')
       LIMIT 1`,
      [callerId, module]
    );

    if (adminCheck.rows.length === 0) {
      throw new PermissionDeniedError(
        `User does not have permission to manage roles in module: ${module}`,
        { caller_id: callerId, module }
      );
    }

    return { isSuperadmin: false };
  }

  /**
   * Validate that a role exists and is assignable
   */
  async validateRoleExists(roleKey: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM molam_role_definitions
       WHERE role_key = $1 AND is_active = true AND is_assignable = true
       LIMIT 1`,
      [roleKey]
    );

    if (result.rows.length === 0) {
      throw new RoleNotFoundError(roleKey);
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    callerId: string,
    targetUserId: string,
    request: AssignRoleRequest,
    metadata: AssignRoleMetadata = {}
  ): Promise<{ user_role_id: string; idempotency_key: string }> {
    // Validate permissions
    await this.ensureCallerCanManage(callerId, request.module);

    // Validate role exists
    await this.validateRoleExists(request.role);

    // Generate idempotency key if not provided
    const idempotencyKey = metadata.idempotency_key || randomUUID();

    // Check for duplicate request using idempotency key
    if (metadata.idempotency_key) {
      const existingResult = await this.pool.query(
        `SELECT user_role_id FROM molam_role_management_audit
         WHERE idempotency_key = $1 AND action IN ('assign', 'delegate')
         ORDER BY performed_at DESC
         LIMIT 1`,
        [metadata.idempotency_key]
      );

      if (existingResult.rows.length > 0) {
        // Return existing result (idempotent)
        return {
          user_role_id: existingResult.rows[0].user_role_id,
          idempotency_key: metadata.idempotency_key
        };
      }
    }

    // Assign role using SQL function
    const result = await this.pool.query(
      `SELECT assign_role_with_delegation(
        $1, $2, $3, $4, $5, $6, $7,
        CASE WHEN $8 IS NOT NULL THEN $7 ELSE NULL END,
        $8, $9
      ) AS user_role_id`,
      [
        targetUserId,
        request.role,
        request.module,
        request.access_scope || 'read',
        request.trusted_level || 0,
        request.expires_at ? new Date(request.expires_at) : null,
        callerId, // assigned_by
        request.delegation_reason, // delegated_by if delegation_reason provided
        request.delegation_reason,
        request.reason
      ]
    );

    const userRoleId = result.rows[0].user_role_id;

    // Log to audit
    await this.pool.query(
      `INSERT INTO molam_role_management_audit (
        performed_by, target_user, action, module, role_key,
        new_state, reason, delegation_reason, ip_address, user_agent, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        callerId,
        targetUserId,
        request.delegation_reason ? 'delegate' : 'assign',
        request.module,
        request.role,
        JSON.stringify({ user_role_id: userRoleId, ...request }),
        request.reason,
        request.delegation_reason,
        metadata.ip_address,
        metadata.user_agent,
        idempotencyKey
      ]
    );

    return { user_role_id: userRoleId, idempotency_key: idempotencyKey };
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(
    callerId: string,
    targetUserId: string,
    request: RevokeRoleRequest,
    metadata: AssignRoleMetadata = {}
  ): Promise<{ success: boolean }> {
    // Validate permissions
    await this.ensureCallerCanManage(callerId, request.module);

    // Validate role exists
    await this.validateRoleExists(request.role);

    // Revoke using SQL function
    const result = await this.pool.query(
      `SELECT revoke_role_by_module($1, $2, $3, $4, $5) AS success`,
      [targetUserId, request.role, request.module, callerId, request.reason]
    );

    const success = result.rows[0].success;

    if (!success) {
      // Role doesn't exist or already revoked
      return { success: false };
    }

    // Log to audit
    await this.pool.query(
      `INSERT INTO molam_role_management_audit (
        performed_by, target_user, action, module, role_key,
        reason, ip_address, user_agent
      ) VALUES ($1, $2, 'revoke', $3, $4, $5, $6, $7)`,
      [
        callerId,
        targetUserId,
        request.module,
        request.role,
        request.reason,
        metadata.ip_address,
        metadata.user_agent
      ]
    );

    return { success: true };
  }

  /**
   * Search users by role/module/query
   */
  async searchUsers(request: SearchUsersRequest): Promise<UserRoleSearch[]> {
    const { module, role, q, page = 1, pageSize = 20 } = request;
    const offset = (page - 1) * pageSize;

    const result = await this.pool.query(
      `SELECT * FROM search_users_by_role($1, $2, $3, $4, $5)`,
      [module || null, role || null, q || null, pageSize, offset]
    );

    return result.rows;
  }

  /**
   * Get role statistics
   */
  async getRoleStatistics(module?: Module): Promise<RoleStatistics[]> {
    const result = await this.pool.query(
      `SELECT * FROM get_role_statistics_by_module($1)`,
      [module || null]
    );

    return result.rows;
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(query: AuditQuery): Promise<RoleAudit[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (query.userId) {
      params.push(query.userId);
      conditions.push(`target_user = $${params.length}`);
    }

    if (query.performedBy) {
      params.push(query.performedBy);
      conditions.push(`performed_by = $${params.length}`);
    }

    if (query.module) {
      params.push(query.module);
      conditions.push(`module = $${params.length}`);
    }

    if (query.action) {
      params.push(query.action);
      conditions.push(`action = $${params.length}`);
    }

    if (query.startDate) {
      params.push(query.startDate);
      conditions.push(`performed_at >= $${params.length}`);
    }

    if (query.endDate) {
      params.push(query.endDate);
      conditions.push(`performed_at <= $${params.length}`);
    }

    const sql = `
      SELECT *
      FROM molam_role_management_audit
      WHERE ${conditions.join(' AND ')}
      ORDER BY performed_at DESC
      LIMIT ${query.limit || 100}
      OFFSET ${query.offset || 0}
    `;

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  /**
   * Bulk assign roles to multiple users
   */
  async bulkAssignRoles(
    callerId: string,
    request: BulkAssignRequest,
    metadata: AssignRoleMetadata = {}
  ): Promise<{ successful: string[]; failed: Array<{ user_id: string; error: string }> }> {
    const successful: string[] = [];
    const failed: Array<{ user_id: string; error: string }> = [];

    for (const userId of request.user_ids) {
      try {
        const assignRequest: AssignRoleRequest = {
          module: request.module,
          role: request.role,
          access_scope: request.access_scope,
          trusted_level: request.trusted_level,
          expires_at: request.expires_at,
          reason: request.reason
        };

        await this.assignRole(callerId, userId, assignRequest, metadata);
        successful.push(userId);
      } catch (error: any) {
        failed.push({
          user_id: userId,
          error: error.message
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Bulk revoke roles from multiple users
   */
  async bulkRevokeRoles(
    callerId: string,
    request: BulkRevokeRequest,
    metadata: AssignRoleMetadata = {}
  ): Promise<{ successful: string[]; failed: Array<{ user_id: string; error: string }> }> {
    const successful: string[] = [];
    const failed: Array<{ user_id: string; error: string }> = [];

    for (const userId of request.user_ids) {
      try {
        const revokeRequest: RevokeRoleRequest = {
          module: request.module,
          role: request.role,
          reason: request.reason
        };

        const result = await this.revokeRole(callerId, userId, revokeRequest, metadata);
        if (result.success) {
          successful.push(userId);
        }
      } catch (error: any) {
        failed.push({
          user_id: userId,
          error: error.message
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Expire roles past their expiration date
   */
  async expireRoles(): Promise<number> {
    const result = await this.pool.query(`SELECT expire_roles() AS count`);
    return result.rows[0].count;
  }

  /**
   * Refresh materialized view
   */
  async refreshMaterializedView(): Promise<void> {
    await this.pool.query(`SELECT refresh_effective_roles_view()`);
  }

  /**
   * Get user's highest trust level across all modules
   */
  async getHighestTrustLevel(userId: string, module?: Module): Promise<number> {
    let query = `
      SELECT COALESCE(MAX(trusted_level), 0) AS max_trust_level
      FROM mv_effective_user_roles
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (module) {
      params.push(module);
      query += ` AND module = $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows[0].max_trust_level;
  }

  /**
   * Get all delegations by a user
   */
  async getDelegationsByUser(delegatorId: string): Promise<UserRole[]> {
    const result = await this.pool.query(
      `SELECT * FROM mv_effective_user_roles
       WHERE delegated_by = $1
       ORDER BY module, role_key, expires_at`,
      [delegatorId]
    );

    return result.rows;
  }

  /**
   * Get roles expiring soon (within next 7 days)
   */
  async getExpiringSoon(days: number = 7): Promise<UserRole[]> {
    const result = await this.pool.query(
      `SELECT * FROM mv_effective_user_roles
       WHERE expires_at IS NOT NULL
       AND expires_at <= NOW() + $1 * INTERVAL '1 day'
       ORDER BY expires_at`,
      [days]
    );

    return result.rows;
  }
}
