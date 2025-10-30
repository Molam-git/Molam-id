/**
 * Molam ID - Admin Service
 * Business logic for global administration
 */
import {
  createTenant,
  listTenants,
  getTenantById,
  updateTenantModule,
  getTenantModules,
  upsertPolicy,
  listPolicies,
  createLock,
  listActiveLocks,
  deleteLock,
  registerKey,
  listKeys,
  getActiveKeys,
  exportAdminAudit,
} from './repo';
import { vaultRotateJwtKey } from '../crypto/vault';
import { checkPermission } from '../util/rbac';
import { publish } from '../util/kafka';
import { getRedis } from '../util/redis';
import {
  TenantDTO,
  ModuleUpdateDTO,
  PolicyDTO,
  LockDTO,
  KeyRotationDTO,
  ServiceError,
  KeyRotationResult,
  TenantRecord,
  TenantModuleRecord,
  PolicyRecord,
  LockRecord,
  KeyRecord,
} from '../types';

/**
 * Ensure actor is a superadmin
 */
export async function ensureSuperAdmin(actorId: string): Promise<void> {
  const ok = await checkPermission(actorId, 'id.admin.super', { scope: 'global' });
  if (!ok) {
    throw new ServiceError('Forbidden: Superadmin access required', 403, 'forbidden');
  }
}

/**
 * Create a new tenant
 */
export async function svcCreateTenant(actorId: string, dto: TenantDTO): Promise<TenantRecord> {
  await ensureSuperAdmin(actorId);

  const tenant = await createTenant(dto, actorId);

  await publish('id.admin.tenant.created', {
    id: tenant.id,
    code: tenant.code,
    name: tenant.name,
    by: actorId,
    ts: Date.now(),
  });

  return tenant;
}

/**
 * List all tenants
 */
export async function svcListTenants(actorId: string): Promise<TenantRecord[]> {
  await ensureSuperAdmin(actorId);
  return await listTenants();
}

/**
 * Get tenant by ID
 */
export async function svcGetTenant(actorId: string, tenantId: string): Promise<TenantRecord> {
  await ensureSuperAdmin(actorId);
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new ServiceError('Tenant not found', 404, 'tenant_not_found');
  }
  return tenant;
}

/**
 * Update module status for a tenant
 */
export async function svcUpdateModule(
  actorId: string,
  tenantId: string,
  module: string,
  dto: ModuleUpdateDTO
): Promise<TenantModuleRecord> {
  await ensureSuperAdmin(actorId);

  // Verify tenant exists
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new ServiceError('Tenant not found', 404, 'tenant_not_found');
  }

  const moduleRecord = await updateTenantModule(tenantId, module, dto, actorId);

  await publish('id.admin.module.updated', {
    tenant_id: tenantId,
    tenant_code: tenant.code,
    module,
    status: dto.status,
    by: actorId,
    ts: Date.now(),
  });

  // Invalidate cache
  const redis = getRedis();
  await redis.del(`tenant:${tenantId}:module:${module}`);

  return moduleRecord;
}

/**
 * Get tenant modules
 */
export async function svcGetTenantModules(
  actorId: string,
  tenantId: string
): Promise<TenantModuleRecord[]> {
  await ensureSuperAdmin(actorId);
  return await getTenantModules(tenantId);
}

/**
 * Upsert a policy
 */
export async function svcUpsertPolicy(actorId: string, dto: PolicyDTO): Promise<PolicyRecord> {
  await ensureSuperAdmin(actorId);

  const policy = await upsertPolicy(dto, actorId);

  await publish('id.admin.policy.updated', {
    id: policy.id,
    key: policy.key,
    tenant_id: policy.tenant_id,
    module_scope: policy.module_scope,
    by: actorId,
    ts: Date.now(),
  });

  // Invalidate cache
  const redis = getRedis();
  const cacheKey = `policy:${policy.tenant_id ?? 'global'}:${policy.module_scope}:${policy.key}`;
  await redis.del(cacheKey);

  return policy;
}

/**
 * List policies
 */
export async function svcListPolicies(
  actorId: string,
  filters?: { tenant_id?: string | null; module_scope?: string }
): Promise<PolicyRecord[]> {
  await ensureSuperAdmin(actorId);
  return await listPolicies(filters);
}

/**
 * Create an emergency lock
 */
export async function svcCreateLock(actorId: string, dto: LockDTO): Promise<LockRecord> {
  await ensureSuperAdmin(actorId);

  // Validate scope-specific requirements
  if (dto.scope === 'tenant' && !dto.tenant_id) {
    throw new ServiceError('tenant_id required for tenant scope', 400, 'tenant_required');
  }
  if (dto.scope === 'module' && (!dto.tenant_id || !dto.module_scope)) {
    throw new ServiceError(
      'tenant_id and module_scope required for module scope',
      400,
      'tenant_and_module_required'
    );
  }
  if (dto.scope === 'role' && !dto.role_id) {
    throw new ServiceError('role_id required for role scope', 400, 'role_required');
  }

  // Validate TTL bounds (1 minute to 7 days)
  if (dto.ttl_seconds < 60 || dto.ttl_seconds > 604800) {
    throw new ServiceError(
      'ttl_seconds must be between 60 and 604800 (7 days)',
      400,
      'invalid_ttl'
    );
  }

  const lock = await createLock(dto, actorId);

  await publish('id.admin.lock.created', {
    id: lock.id,
    scope: lock.scope,
    tenant_id: lock.tenant_id,
    module_scope: lock.module_scope,
    role_id: lock.role_id,
    reason: lock.reason,
    ttl_seconds: lock.ttl_seconds,
    by: actorId,
    ts: Date.now(),
  });

  return lock;
}

/**
 * List active emergency locks
 */
export async function svcListActiveLocks(actorId: string): Promise<LockRecord[]> {
  await ensureSuperAdmin(actorId);
  return await listActiveLocks();
}

/**
 * Delete an emergency lock
 */
export async function svcDeleteLock(actorId: string, lockId: string): Promise<void> {
  await ensureSuperAdmin(actorId);

  const deleted = await deleteLock(lockId, actorId);
  if (!deleted) {
    throw new ServiceError('Lock not found', 404, 'lock_not_found');
  }

  await publish('id.admin.lock.deleted', {
    id: lockId,
    by: actorId,
    ts: Date.now(),
  });
}

/**
 * Rotate JWT signing keys
 */
export async function svcRotateKeys(
  actorId: string,
  dto?: KeyRotationDTO
): Promise<KeyRotationResult> {
  await ensureSuperAdmin(actorId);

  // Call Vault/HSM to generate new keypair
  const { kid, alg, publicKeyPem } = await vaultRotateJwtKey(dto?.alg || 'RS256');

  // Register the new key as 'staging'
  await registerKey(kid, alg, 'staging', actorId, publicKeyPem);

  // Optionally: mark previous active key as 'retiring'
  const activeKeys = await listKeys('active');
  for (const key of activeKeys) {
    await registerKey(key.kid, key.alg, 'retiring', actorId);
  }

  await publish('id.admin.keys.rotated', {
    kid,
    alg,
    status: 'staging',
    by: actorId,
    ts: Date.now(),
  });

  return {
    kid,
    alg,
    status: 'staging',
    message: 'Key rotation initiated. New key is staging. Activate manually after testing.',
  };
}

/**
 * List keys
 */
export async function svcListKeys(actorId: string, status?: string): Promise<KeyRecord[]> {
  await ensureSuperAdmin(actorId);
  return await listKeys(status);
}

/**
 * Get active keys for JWKS
 */
export async function svcGetActiveKeys(actorId: string): Promise<KeyRecord[]> {
  await ensureSuperAdmin(actorId);
  return await getActiveKeys();
}

/**
 * Export admin audit logs
 */
export async function svcExportAudit(
  actorId: string,
  filters?: {
    from?: Date;
    to?: Date;
    action_filter?: string;
  }
): Promise<any[]> {
  await ensureSuperAdmin(actorId);
  return await exportAdminAudit(filters);
}
