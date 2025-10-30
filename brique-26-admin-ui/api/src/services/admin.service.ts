// api/src/services/admin.service.ts
// Admin service with subsidiary filtering

import { Pool } from 'pg';
import type {
  Employee,
  EmployeeWithUser,
  CreateEmployeeDTO,
  UpdateEmployeeDTO,
  AdminAction,
  AdminAuditEntry,
  AssignRoleDTO,
  RevokeRoleDTO,
  SessionInfo,
  DepartmentStats,
  AdminPermissions,
  Department,
  ServiceError
} from '../types';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================================================
// ADMIN PERMISSIONS
// ============================================================================

export async function getAdminPermissions(adminUserId: string): Promise<AdminPermissions> {
  const result = await pool.query(`
    SELECT
      EXISTS(
        SELECT 1 FROM molam_role_grants rg
        JOIN molam_roles_v2 r ON r.id = rg.role_id
        WHERE rg.user_id = $1 AND r.name = 'super_admin'
          AND rg.revoked_at IS NULL
          AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
      ) AS is_super_admin,
      get_admin_accessible_departments($1) AS accessible_departments
  `, [adminUserId]);

  const row = result.rows[0];
  return {
    is_super_admin: row.is_super_admin,
    accessible_departments: row.accessible_departments || [],
    can_create_employees: true,
    can_assign_roles: true,
    can_revoke_sessions: true,
    can_view_audit: true
  };
}

// ============================================================================
// EMPLOYEES
// ============================================================================

export async function listEmployees(
  adminUserId: string,
  department?: Department,
  includeInactive = false
): Promise<EmployeeWithUser[]> {
  const result = await pool.query(`
    SELECT * FROM get_employees_by_department($1, $2, $3)
  `, [adminUserId, department, includeInactive]);

  return result.rows;
}

export async function getEmployee(adminUserId: string, employeeId: string): Promise<EmployeeWithUser> {
  const result = await pool.query(`
    SELECT * FROM molam_employees_with_roles
    WHERE id = $1
  `, [employeeId]);

  if (result.rows.length === 0) {
    const error: ServiceError = new Error('Employee not found');
    error.statusCode = 404;
    throw error;
  }

  const employee = result.rows[0];

  // Check permission
  const permissions = await getAdminPermissions(adminUserId);
  if (!permissions.accessible_departments.includes(employee.department)) {
    const error: ServiceError = new Error('Access denied to this department');
    error.statusCode = 403;
    throw error;
  }

  return employee;
}

export async function createEmployee(
  adminUserId: string,
  dto: CreateEmployeeDTO
): Promise<string> {
  const result = await pool.query(`
    SELECT create_employee($1, $2, $3, $4, $5, $6, $7)
  `, [
    adminUserId,
    dto.user_id,
    dto.employee_id,
    dto.department,
    dto.position,
    dto.start_date,
    dto.manager_id
  ]);

  return result.rows[0].create_employee;
}

export async function updateEmployee(
  adminUserId: string,
  employeeId: string,
  dto: UpdateEmployeeDTO
): Promise<void> {
  // Check permission first
  const employee = await getEmployee(adminUserId, employeeId);

  const updates: string[] = [];
  const values: any[] = [employeeId];
  let paramIndex = 2;

  if (dto.position !== undefined) {
    updates.push(`position = $${paramIndex++}`);
    values.push(dto.position);
  }
  if (dto.manager_id !== undefined) {
    updates.push(`manager_id = $${paramIndex++}`);
    values.push(dto.manager_id);
  }
  if (dto.is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(dto.is_active);
  }
  if (dto.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(dto.metadata));
  }

  if (updates.length === 0) {
    return;
  }

  await pool.query(`
    UPDATE molam_employees
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $1
  `, values);

  // Log action
  await pool.query(`
    SELECT log_admin_action($1, 'employee.update', $2, $3, $4)
  `, [
    adminUserId,
    employee.user_id,
    employee.department,
    JSON.stringify(dto)
  ]);
}

export async function deactivateEmployee(
  adminUserId: string,
  employeeId: string,
  reason: string
): Promise<void> {
  const employee = await getEmployee(adminUserId, employeeId);

  await pool.query(`
    UPDATE molam_employees
    SET is_active = false, end_date = CURRENT_DATE, updated_at = NOW()
    WHERE id = $1
  `, [employeeId]);

  // Log action
  await pool.query(`
    SELECT log_admin_action($1, 'employee.deactivate', $2, $3, $4)
  `, [
    adminUserId,
    employee.user_id,
    employee.department,
    JSON.stringify({ reason })
  ]);
}

// ============================================================================
// ROLES
// ============================================================================

export async function listRoles(department?: Department): Promise<any[]> {
  const query = department
    ? `SELECT * FROM molam_roles_v2 WHERE module_scope = $1 ORDER BY trusted_level DESC`
    : `SELECT * FROM molam_roles_v2 ORDER BY module_scope, trusted_level DESC`;

  const result = await pool.query(query, department ? [department] : []);
  return result.rows;
}

export async function assignRole(
  adminUserId: string,
  dto: AssignRoleDTO
): Promise<void> {
  // Check permission
  const permissions = await getAdminPermissions(adminUserId);
  if (!permissions.accessible_departments.includes(dto.module_scope as Department)) {
    const error: ServiceError = new Error('Access denied to assign roles in this department');
    error.statusCode = 403;
    throw error;
  }

  // Grant role
  await pool.query(`
    INSERT INTO molam_role_grants(user_id, role_id, module_scope, granted_by, expires_at, justification)
    VALUES($1, $2, $3, $4, $5, $6)
  `, [
    dto.user_id,
    dto.role_id,
    dto.module_scope,
    adminUserId,
    dto.expires_at,
    dto.justification
  ]);

  // Log action
  await pool.query(`
    SELECT log_admin_action($1, 'role.assign', $2, $3, $4)
  `, [
    adminUserId,
    dto.user_id,
    dto.module_scope,
    JSON.stringify(dto)
  ]);
}

export async function revokeRole(
  adminUserId: string,
  dto: RevokeRoleDTO
): Promise<void> {
  // Revoke role
  await pool.query(`
    UPDATE molam_role_grants
    SET revoked_at = NOW(), revoked_by = $1
    WHERE user_id = $2 AND role_id = $3 AND revoked_at IS NULL
  `, [adminUserId, dto.user_id, dto.role_id]);

  // Log action
  await pool.query(`
    SELECT log_admin_action($1, 'role.revoke', $2, NULL, $3)
  `, [
    adminUserId,
    dto.user_id,
    JSON.stringify(dto)
  ]);
}

// ============================================================================
// SESSIONS
// ============================================================================

export async function listSessions(
  adminUserId: string,
  department?: Department
): Promise<SessionInfo[]> {
  const permissions = await getAdminPermissions(adminUserId);

  let query = `
    SELECT
      s.id,
      s.user_id,
      e.employee_id,
      e.department,
      s.device_id,
      s.device_type,
      s.ip_address,
      s.created_at,
      s.last_seen,
      s.revoked_at
    FROM molam_sessions_active s
    LEFT JOIN molam_employees e ON e.user_id = s.user_id
  `;

  const conditions: string[] = [];
  const values: any[] = [];

  if (!permissions.is_super_admin && permissions.accessible_departments.length > 0) {
    conditions.push(`e.department = ANY($${values.length + 1})`);
    values.push(permissions.accessible_departments);
  }

  if (department) {
    conditions.push(`e.department = $${values.length + 1}`);
    values.push(department);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY s.created_at DESC LIMIT 100`;

  const result = await pool.query(query, values);
  return result.rows;
}

export async function revokeSession(
  adminUserId: string,
  sessionId: string
): Promise<void> {
  await pool.query(`
    UPDATE molam_sessions_active
    SET revoked_at = NOW(), is_active = FALSE
    WHERE id = $1
  `, [sessionId]);

  // Log action
  await pool.query(`
    SELECT log_admin_action($1, 'session.revoke', NULL, NULL, $2)
  `, [adminUserId, JSON.stringify({ session_id: sessionId })]);
}

// ============================================================================
// AUDIT
// ============================================================================

export async function listAudit(
  adminUserId: string,
  department?: Department,
  limit = 100
): Promise<AdminAuditEntry[]> {
  const permissions = await getAdminPermissions(adminUserId);

  let query = `SELECT * FROM molam_admin_audit_view`;
  const conditions: string[] = [];
  const values: any[] = [];

  if (!permissions.is_super_admin && permissions.accessible_departments.length > 0) {
    conditions.push(`department = ANY($${values.length + 1})`);
    values.push(permissions.accessible_departments);
  }

  if (department) {
    conditions.push(`department = $${values.length + 1}`);
    values.push(department);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
  values.push(limit);

  const result = await pool.query(query, values);
  return result.rows;
}

// ============================================================================
// STATISTICS
// ============================================================================

export async function getDepartmentStats(
  adminUserId: string
): Promise<DepartmentStats[]> {
  const permissions = await getAdminPermissions(adminUserId);

  let query = `SELECT * FROM molam_department_stats`;

  if (!permissions.is_super_admin && permissions.accessible_departments.length > 0) {
    query += ` WHERE department = ANY($1)`;
    const result = await pool.query(query, [permissions.accessible_departments]);
    return result.rows;
  }

  const result = await pool.query(query);
  return result.rows;
}

export default {
  getAdminPermissions,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  listRoles,
  assignRole,
  revokeRole,
  listSessions,
  revokeSession,
  listAudit,
  getDepartmentStats
};
