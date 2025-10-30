/**
 * Molam ID - Brique 21: Role Management Types
 * Defines core types for role management operations
 */

export type ModuleScope = 'global' | 'pay' | 'eats' | 'talk' | 'ads' | 'shop' | 'free' | 'id';

export type RoleType = 'external' | 'internal';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Role Data Transfer Object
 */
export interface RoleDTO {
  id?: string;
  name: string;
  module_scope: ModuleScope;
  role_type?: RoleType;
  description?: string;
  trusted_level: number; // 0-100, higher = more privileged
  priority?: number;
  is_system?: boolean;
}

/**
 * Role Grant Request DTO
 */
export interface GrantDTO {
  user_id: string;
  role_id: string;
  require_approval?: boolean;
  scope_constraint?: string;
  expires_at?: string; // ISO date
  justification?: string;
}

/**
 * Role Revocation Request DTO
 */
export interface RevokeDTO {
  user_id: string;
  role_id: string;
  reason?: string;
}

/**
 * Approval Request DTO
 */
export interface ApprovalDTO {
  request_id: string;
  approve: boolean;
  reason?: string;
}

/**
 * Database Role Record
 */
export interface RoleRecord {
  id: string;
  name: string;
  role_type: RoleType;
  module_scope: ModuleScope;
  description: string | null;
  trusted_level: number;
  priority: number;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database User Role Record
 */
export interface UserRoleRecord {
  id: string;
  user_id: string;
  role_id: string;
  granted_by: string;
  scope_constraint: string | null;
  expires_at: Date | null;
  justification: string | null;
  created_at: Date;
}

/**
 * Approval Request Record
 */
export interface ApprovalRecord {
  id: string;
  request_id: string;
  user_id: string;
  role_id: string;
  requested_by: string;
  approver_required: boolean;
  approved_by: string | null;
  approved_at: Date | null;
  status: ApprovalStatus;
  reason: string | null;
  justification: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Idempotency Key Record
 */
export interface IdempotencyRecord {
  key: string;
  request_hash: string;
  response_code: number;
  response_body: any;
  created_at: Date;
  expires_at: Date;
}

/**
 * Service Response Types
 */
export interface RoleGrantResponse {
  status: 'granted' | 'already_assigned' | 'pending';
  request_id?: string;
  message?: string;
}

export interface RoleRevokeResponse {
  status: 'revoked' | 'not_assigned';
  message?: string;
}

export interface ApprovalResponse {
  status: 'approved' | 'rejected';
  granted?: boolean;
  message?: string;
}

/**
 * Express Request User (from JWT)
 */
export interface RequestUser {
  sub: string; // user_id
  email?: string;
  phone_e164?: string;
  iat?: number;
  exp?: number;
}

/**
 * Permission Context for RBAC checks
 */
export interface PermissionContext {
  scope?: string;
  role?: string;
  path?: string;
  method?: string;
  ip_address?: string;
  [key: string]: any;
}

/**
 * Error with status code
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}
