// brique-31-rbac-granular/api/src/services/rbac/rbac.service.ts
// Granular RBAC service for multi-subsidiary platform

import { Pool } from 'pg';

// =====================================================
// TYPES
// =====================================================

export type RoleType = 'external' | 'internal' | 'partner' | 'system';
export type AccessScope = 'read' | 'write' | 'admin' | 'owner';
export type AccessLevel = 'none' | 'read' | 'write' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Module = 'pay' | 'eats' | 'shop' | 'talk' | 'ads' | 'free' | 'id' | 'global';

export interface RoleDefinition {
  role_id: number;
  role_key: string;
  role_name: string;
  role_type: RoleType;
  description?: string;
  min_trust_level: number;
  max_trust_level: number;
  is_assignable: boolean;
  requires_approval: boolean;
  is_active: boolean;
}

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
  approval_status: ApprovalStatus;
}

export interface Permission {
  module: Module;
  resource: string;
  action: string;
  access_level: AccessLevel;
  conditions?: Record<string, any>;
}

export interface AssignRoleRequest {
  user_id: string;
  role_key: string;
  module: Module;
  access_scope?: AccessScope;
  trusted_level?: number;
  assigned_by: string;
  reason?: string;
  expires_at?: Date;
}

export interface RevokeRoleRequest {
  user_role_id: string;
  revoked_by: string;
  reason?: string;
}

export interface PermissionCheckContext {
  own_only?: boolean;
  max_amount?: number;
  subsidiary_id?: string;
  [key: string]: any;
}

// =====================================================
// RBAC SERVICE
// =====================================================

export class RBACService {
  constructor(private pool: Pool) {}

  // =====================================================
  // ROLE DEFINITIONS
  // =====================================================

  async getRoleDefinitions(roleType?: RoleType): Promise<RoleDefinition[]> {
    const query = `
      SELECT role_id, role_key, role_name, role_type, description,
             min_trust_level, max_trust_level, is_assignable, requires_approval, is_active
      FROM molam_role_definitions
      WHERE is_active = true
        AND ($1::TEXT IS NULL OR role_type = $1)
      ORDER BY role_type, role_name
    `;

    const result = await this.pool.query(query, [roleType || null]);
    return result.rows;
  }

  async getRoleDefinition(roleKey: string): Promise<RoleDefinition | null> {
    const result = await this.pool.query(
      `SELECT * FROM molam_role_definitions WHERE role_key = $1`,
      [roleKey]
    );

    return result.rows[0] || null;
  }

  // =====================================================
  // USER ROLES
  // =====================================================

  async getUserRoles(userId: string, module?: Module): Promise<UserRole[]> {
    const result = await this.pool.query(
      `SELECT * FROM get_user_roles($1)`,
      [userId]
    );

    const roles = result.rows;

    if (module) {
      return roles.filter((r: UserRole) => r.module === module);
    }

    return roles;
  }

  async getUserRole(userRoleId: string): Promise<UserRole | null> {
    const result = await this.pool.query(
      `SELECT ur.*, rd.role_name
       FROM molam_user_roles ur
       JOIN molam_role_definitions rd ON ur.role_key = rd.role_key
       WHERE ur.user_role_id = $1`,
      [userRoleId]
    );

    return result.rows[0] || null;
  }

  async assignRole(request: AssignRoleRequest): Promise<string> {
    try {
      const result = await this.pool.query(
        `SELECT assign_role($1, $2, $3, $4, $5, $6, $7, $8) AS user_role_id`,
        [
          request.user_id,
          request.role_key,
          request.module,
          request.access_scope || 'read',
          request.trusted_level || 0,
          request.assigned_by,
          request.reason || null,
          request.expires_at || null
        ]
      );

      return result.rows[0].user_role_id;
    } catch (error: any) {
      if (error.message.includes('role_not_assignable')) {
        throw new Error('Role does not exist or is not assignable');
      }
      if (error.message.includes('role_already_assigned')) {
        throw new Error('User already has this role for this module');
      }
      throw error;
    }
  }

  async revokeRole(request: RevokeRoleRequest): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT revoke_role($1, $2, $3) AS success`,
      [request.user_role_id, request.revoked_by, request.reason || null]
    );

    return result.rows[0].success;
  }

  async approveRole(userRoleId: string, approvedBy: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE molam_user_roles
       SET approval_status = 'approved',
           approved_by = $2,
           approved_at = NOW()
       WHERE user_role_id = $1
         AND approval_status = 'pending'
         AND revoked_at IS NULL`,
      [userRoleId, approvedBy]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  async rejectRole(userRoleId: string, approvedBy: string, reason?: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE molam_user_roles
       SET approval_status = 'rejected',
           approved_by = $2,
           approved_at = NOW(),
           revoked_at = NOW(),
           revoked_by = $2,
           revoked_reason = $3,
           is_active = false
       WHERE user_role_id = $1
         AND approval_status = 'pending'
         AND revoked_at IS NULL`,
      [userRoleId, approvedBy, reason || 'Rejected during approval']
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getPendingApprovals(module?: Module): Promise<UserRole[]> {
    let query = `SELECT * FROM v_pending_role_approvals`;

    if (module) {
      query += ` WHERE module = $1`;
      const result = await this.pool.query(query, [module]);
      return result.rows;
    }

    const result = await this.pool.query(query);
    return result.rows;
  }

  // =====================================================
  // PERMISSIONS
  // =====================================================

  async getUserPermissions(userId: string, module?: Module): Promise<Permission[]> {
    const result = await this.pool.query(
      `SELECT * FROM get_user_permissions($1, $2)`,
      [userId, module || null]
    );

    return result.rows;
  }

  async hasPermission(
    userId: string,
    module: Module,
    resource: string,
    action: string,
    context: PermissionCheckContext = {}
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT has_permission($1, $2, $3, $4, $5) AS has_permission`,
      [userId, module, resource, action, JSON.stringify(context)]
    );

    return result.rows[0].has_permission;
  }

  async checkPermission(
    userId: string,
    module: Module,
    resource: string,
    action: string,
    context: PermissionCheckContext = {}
  ): Promise<void> {
    const hasPermission = await this.hasPermission(userId, module, resource, action, context);

    if (!hasPermission) {
      throw new PermissionDeniedError(
        `Permission denied: ${module}:${resource}:${action}`,
        { userId, module, resource, action, context }
      );
    }
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  async getRoleStatistics(module?: Module): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM get_role_statistics($1)`,
      [module || null]
    );

    return result.rows;
  }

  async getUserRoleCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS count
       FROM molam_user_roles
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND approval_status = 'approved'`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  // =====================================================
  // AUDIT
  // =====================================================

  async getAuditLogs(
    userId?: string,
    eventType?: string,
    limit: number = 100
  ): Promise<any[]> {
    let query = `
      SELECT audit_id, user_id, event_type, event_timestamp, role_key, module,
             actor_id, ip_address, result, details
      FROM molam_role_audit
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (eventType) {
      query += ` AND event_type = $${paramIndex++}`;
      params.push(eventType);
    }

    query += ` ORDER BY event_timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // =====================================================
  // MAINTENANCE
  // =====================================================

  async expireTemporalRoles(): Promise<number> {
    const result = await this.pool.query(
      `SELECT expire_temporal_roles() AS count`
    );

    return result.rows[0].count;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  async hasRole(userId: string, roleKey: string, module: Module): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM molam_user_roles
        WHERE user_id = $1
          AND role_key = $2
          AND module = $3
          AND revoked_at IS NULL
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
          AND approval_status = 'approved'
      ) AS has_role`,
      [userId, roleKey, module]
    );

    return result.rows[0].has_role;
  }

  async hasAnyRole(userId: string, roleKeys: string[], module: Module): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM molam_user_roles
        WHERE user_id = $1
          AND role_key = ANY($2)
          AND module = $3
          AND revoked_at IS NULL
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
          AND approval_status = 'approved'
      ) AS has_role`,
      [userId, roleKeys, module]
    );

    return result.rows[0].has_role;
  }

  async getHighestTrustLevel(userId: string, module?: Module): Promise<number> {
    let query = `
      SELECT COALESCE(MAX(trusted_level), 0) AS trust_level
      FROM molam_user_roles
      WHERE user_id = $1
        AND revoked_at IS NULL
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND approval_status = 'approved'
    `;

    const params: any[] = [userId];

    if (module) {
      query += ` AND module = $2`;
      params.push(module);
    }

    const result = await this.pool.query(query, params);
    return result.rows[0].trust_level;
  }

  async getUserModules(userId: string): Promise<Module[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT module
       FROM molam_user_roles
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND approval_status = 'approved'
       ORDER BY module`,
      [userId]
    );

    return result.rows.map((r) => r.module);
  }
}

// =====================================================
// CUSTOM ERROR
// =====================================================

export class PermissionDeniedError extends Error {
  public readonly code = 'PERMISSION_DENIED';
  public readonly context: any;

  constructor(message: string, context?: any) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.context = context;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionDeniedError);
    }
  }
}
