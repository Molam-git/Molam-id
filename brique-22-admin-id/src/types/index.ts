/**
 * Molam ID - Brique 22: Admin ID Types
 * Types for global admin operations
 */

export type ModuleScope = 'pay' | 'eats' | 'talk' | 'ads' | 'shop' | 'free' | 'id' | 'global';

export type ModuleStatus = 'enabled' | 'disabled' | 'maintenance' | 'readonly';

export type LockScope = 'global' | 'tenant' | 'module' | 'role';

export type KeyStatus = 'active' | 'staging' | 'retiring' | 'retired';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Tenant (Country) Data Transfer Object
 */
export interface TenantDTO {
  code: string;                   // ISO 3166-1 alpha-2 (e.g., "SN", "CI")
  name: string;                   // Human-readable name
  default_currency: string;       // ISO 4217 (e.g., "XOF", "EUR")
  timezone: string;               // IANA timezone (e.g., "Africa/Dakar")
  phone_country_code: string;     // E.164 prefix (e.g., "+221")
  email_regex: string;            // Email validation regex
  phone_regex: string;            // Phone validation regex
  is_active?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Module Status Update DTO
 */
export interface ModuleUpdateDTO {
  status: ModuleStatus;
  maintenance_message?: string;
}

/**
 * Policy DTO
 */
export interface PolicyDTO {
  tenant_id?: string | null;      // NULL for global policies
  module_scope: ModuleScope;
  key: string;                    // e.g., "password.min_length"
  value: any;                     // Flexible JSON value
  description?: string;
}

/**
 * Emergency Lock DTO
 */
export interface LockDTO {
  scope: LockScope;
  tenant_id?: string | null;
  module_scope?: ModuleScope | null;
  role_id?: string | null;
  reason: string;                 // Justification (required)
  ttl_seconds: number;            // 60 seconds to 7 days
}

/**
 * Key Rotation Request DTO
 */
export interface KeyRotationDTO {
  alg?: string;                   // Algorithm (default: RS256)
  force?: boolean;                // Force rotation even if recent
}

/**
 * Audit Export Request DTO
 */
export interface AuditExportDTO {
  from?: string;                  // ISO date
  to?: string;                    // ISO date
  format?: 'csv' | 'ndjson';
  action_filter?: string;
}

/**
 * Database Tenant Record
 */
export interface TenantRecord {
  id: string;
  code: string;
  name: string;
  default_currency: string;
  timezone: string;
  phone_country_code: string;
  email_regex: string;
  phone_regex: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database Tenant Module Record
 */
export interface TenantModuleRecord {
  id: string;
  tenant_id: string;
  module_scope: string;
  status: ModuleStatus;
  maintenance_message: string | null;
  updated_by: string | null;
  updated_at: Date;
  created_at: Date;
}

/**
 * Database Policy Record
 */
export interface PolicyRecord {
  id: string;
  tenant_id: string | null;
  module_scope: string;
  key: string;
  value: any;
  description: string | null;
  updated_by: string | null;
  updated_at: Date;
  created_at: Date;
}

/**
 * Database Emergency Lock Record
 */
export interface LockRecord {
  id: string;
  scope: LockScope;
  tenant_id: string | null;
  module_scope: string | null;
  role_id: string | null;
  reason: string;
  ttl_seconds: number;
  created_by: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Database Key Registry Record
 */
export interface KeyRecord {
  id: string;
  kid: string;
  alg: string;
  key_type: string;
  status: KeyStatus;
  public_key_pem: string | null;
  metadata: Record<string, any>;
  rotated_at: Date | null;
  rotated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database Admin Audit Record
 */
export interface AdminAuditRecord {
  id: string;
  actor_id: string;
  action: string;
  target: any;
  diff: any;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

/**
 * Admin Approval Record
 */
export interface AdminApprovalRecord {
  id: string;
  request_id: string;
  action: string;
  requested_by: string;
  request_payload: any;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Express Request User (from JWT)
 */
export interface RequestUser {
  sub: string;                    // user_id
  email?: string;
  phone_e164?: string;
  iat?: number;
  exp?: number;
  tenant_id?: string;
}

/**
 * Service Error with status code
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

/**
 * Lock Check Context
 */
export interface LockContext {
  tenant_id?: string;
  module_scope?: string;
  role_ids?: string[];
}

/**
 * Key Rotation Result
 */
export interface KeyRotationResult {
  kid: string;
  alg: string;
  status: KeyStatus;
  message: string;
}
