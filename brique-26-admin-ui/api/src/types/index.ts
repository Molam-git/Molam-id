// api/src/types/index.ts
// TypeScript type definitions for Molam Admin Console

export type Department = 'pay' | 'eats' | 'talk' | 'ads' | 'shop' | 'free' | 'id' | 'global';

export type AdminActionType =
  | 'employee.create'
  | 'employee.update'
  | 'employee.deactivate'
  | 'role.assign'
  | 'role.revoke'
  | 'session.revoke'
  | 'audit.export';

export interface Employee {
  id: string;
  user_id: string;
  employee_id: string;
  department: Department;
  position: string;
  manager_id: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithUser extends Employee {
  display_name: string;
  email: string;
  user_type: 'external' | 'internal';
  roles: EmployeeRole[];
}

export interface EmployeeRole {
  role_id: string;
  role_name: string;
  module_scope: string;
  trusted_level: number;
  granted_at: string;
}

export interface CreateEmployeeDTO {
  user_id: string;
  employee_id: string;
  department: Department;
  position: string;
  start_date: string;
  manager_id?: string;
}

export interface UpdateEmployeeDTO {
  position?: string;
  manager_id?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: AdminActionType;
  target_user_id: string | null;
  target_department: Department | null;
  action_details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure' | 'pending';
  created_at: string;
}

export interface AdminAuditEntry {
  id: string;
  user_id: string;
  employee_id: string | null;
  department: Department | null;
  position: string | null;
  action: string;
  context: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AssignRoleDTO {
  user_id: string;
  role_id: string;
  module_scope: string;
  expires_at?: string;
  justification?: string;
}

export interface RevokeRoleDTO {
  user_id: string;
  role_id: string;
  reason: string;
}

export interface SessionInfo {
  id: string;
  user_id: string;
  employee_id: string | null;
  department: Department | null;
  device_id: string | null;
  device_type: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen: string;
  revoked_at: string | null;
}

export interface DepartmentStats {
  department: Department;
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  unique_positions: number;
}

export interface AdminPermissions {
  is_super_admin: boolean;
  accessible_departments: Department[];
  can_create_employees: boolean;
  can_assign_roles: boolean;
  can_revoke_sessions: boolean;
  can_view_audit: boolean;
}

// Express Request extension
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        sub: string;
        email?: string;
        user_type: 'external' | 'internal';
        roles?: string[];
        permissions?: string[];
        department?: Department;
      };
      adminPermissions?: AdminPermissions;
    }
  }
}

export interface ServiceError extends Error {
  statusCode?: number;
  code?: string;
}
