// brique-32-api-role-mgmt/api/src/validators/rbac.schemas.ts
// Zod validation schemas for role management API

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

export const ModuleEnum = z.enum(['pay', 'eats', 'shop', 'talk', 'ads', 'free', 'id', 'global']);
export const AccessScopeEnum = z.enum(['read', 'write', 'admin', 'owner']);
export const RoleActionEnum = z.enum(['assign', 'revoke', 'update', 'delegate', 'expire']);

// =====================================================
// ASSIGN ROLE SCHEMA
// =====================================================

export const AssignRoleSchema = z.object({
  module: ModuleEnum,
  role: z.string().min(2).max(50),
  access_scope: AccessScopeEnum.optional().default('read'),
  trusted_level: z.number().int().min(0).max(5).optional().default(0),
  expires_at: z.string().datetime().optional(),
  delegation_reason: z.string().max(500).optional(),
  reason: z.string().max(500).optional()
}).refine(
  (data) => {
    // If delegation_reason is provided, expires_at must also be provided
    if (data.delegation_reason && !data.expires_at) {
      return false;
    }
    return true;
  },
  {
    message: 'expires_at is required when delegation_reason is provided',
    path: ['expires_at']
  }
);

export type AssignRoleRequest = z.infer<typeof AssignRoleSchema>;

// =====================================================
// REVOKE ROLE SCHEMA
// =====================================================

export const RevokeRoleSchema = z.object({
  module: ModuleEnum,
  role: z.string().min(2).max(50),
  reason: z.string().max(500).optional()
});

export type RevokeRoleRequest = z.infer<typeof RevokeRoleSchema>;

// =====================================================
// SEARCH USERS SCHEMA
// =====================================================

export const SearchUsersSchema = z.object({
  module: ModuleEnum.optional(),
  role: z.string().min(2).max(50).optional(),
  q: z.string().min(1).max(100).optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(20)
});

export type SearchUsersRequest = z.infer<typeof SearchUsersSchema>;

// =====================================================
// LIST ROLES QUERY SCHEMA
// =====================================================

export const ListRolesQuerySchema = z.object({
  includeExpired: z.enum(['true', 'false']).optional().default('false'),
  module: ModuleEnum.optional()
});

export type ListRolesQuery = z.infer<typeof ListRolesQuerySchema>;

// =====================================================
// AUDIT QUERY SCHEMA
// =====================================================

export const AuditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  performedBy: z.string().uuid().optional(),
  module: ModuleEnum.optional(),
  action: RoleActionEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  offset: z.number().int().min(0).optional().default(0)
});

export type AuditQuery = z.infer<typeof AuditQuerySchema>;

// =====================================================
// DELEGATION SCHEMA
// =====================================================

export const DelegateRoleSchema = AssignRoleSchema.extend({
  delegation_reason: z.string().min(10).max(500),
  expires_at: z.string().datetime()
}).required({
  delegation_reason: true,
  expires_at: true
});

export type DelegateRoleRequest = z.infer<typeof DelegateRoleSchema>;

// =====================================================
// BULK OPERATIONS SCHEMA
// =====================================================

export const BulkAssignSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(100),
  role: z.string().min(2).max(50),
  module: ModuleEnum,
  access_scope: AccessScopeEnum.optional().default('read'),
  trusted_level: z.number().int().min(0).max(5).optional().default(0),
  expires_at: z.string().datetime().optional(),
  reason: z.string().max(500).optional()
});

export type BulkAssignRequest = z.infer<typeof BulkAssignSchema>;

export const BulkRevokeSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(100),
  role: z.string().min(2).max(50),
  module: ModuleEnum,
  reason: z.string().max(500).optional()
});

export type BulkRevokeRequest = z.infer<typeof BulkRevokeSchema>;
