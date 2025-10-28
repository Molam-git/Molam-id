// src/admin/service.ts (COMPLETE VERSION)
import { createTenant, listTenants, updateTenantModule, upsertPolicy, createLock, registerKey } from './repo';
import { publish } from '../stream/kafka';
import { checkPermission } from '../rbac/check';
import { redis } from '../repo/redis';
import { vaultRotateJwtKey } from '../crypto/vault';


export async function ensureSuperAdmin(actorId: string) {
    const ok = await checkPermission(actorId, 'id.admin.super', { scope: 'global' });
    if (!ok) throw Object.assign(new Error('forbidden'), { status: 403 });
}

export async function svcCreateTenant(actorId: string, dto: any) {
    await ensureSuperAdmin(actorId);
    const t = await createTenant(dto, actorId);
    await publish('id.admin.tenant.created', { id: t.id, code: t.code });
    return t;
}

export async function svcListTenants(actorId: string) {
    await ensureSuperAdmin(actorId);
    return await listTenants();
}

export async function svcUpdateModule(actorId: string, tenantId: string, module: string, dto: any) {
    await ensureSuperAdmin(actorId);
    const m = await updateTenantModule(tenantId, module, dto, actorId);
    await publish('id.admin.module.updated', { tenant_id: tenantId, module, status: m.status });
    // invalidate feature cache
    await redis.del(`tenant:${tenantId}:module:${module}`);
    return m;
}

export async function svcUpsertPolicy(actorId: string, dto: any) {
    await ensureSuperAdmin(actorId);
    const p = await upsertPolicy(dto, actorId);
    await publish('id.admin.policy.updated', { id: p.id, key: p.key, tenant_id: p.tenant_id, module_scope: p.module_scope });
    await redis.del(`policy:${p.tenant_id ?? 'global'}:${p.module_scope}:${p.key}`);
    return p;
}

export async function svcCreateLock(actorId: string, dto: any) {
    await ensureSuperAdmin(actorId);
    // minimal validation: required pairings per scope
    if (dto.scope === 'tenant' && !dto.tenant_id) throw Object.assign(new Error('tenant_required'), { status: 400 });
    if (dto.scope === 'module' && (!dto.tenant_id || !dto.module_scope)) throw Object.assign(new Error('tenant_and_module_required'), { status: 400 });
    if (dto.scope === 'role' && !dto.role_id) throw Object.assign(new Error('role_required'), { status: 400 });

    const lock = await createLock(dto, actorId);
    await publish('id.admin.lock.created', { id: lock.id, scope: lock.scope });
    return lock;
}

export async function svcRotateKeys(actorId: string) {
    await ensureSuperAdmin(actorId);
    // Call Vault/HSM to create a new signing keypair; returns kid/alg
    const { kid, alg } = await vaultRotateJwtKey();
    const meta = await registerKey(kid, alg, 'staging', actorId);
    await publish('id.admin.keys.rotated', { kid, alg, status: meta.status });
    return { kid, alg, status: meta.status };
}