// src/admin/repo.ts (COMPLETE VERSION)
import { pool } from '../repo';
import { RoleDTO } from '../types';

export async function createTenant(dto: any, actorId: string) {
    const q = `
    INSERT INTO molam_tenants(code, name, default_currency, timezone, phone_country_code, email_regex, phone_regex, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE))
    RETURNING *`;
    const { rows } = await pool.query(q, [
        dto.code, dto.name, dto.default_currency, dto.timezone,
        dto.phone_country_code, dto.email_regex, dto.phone_regex, dto.is_active ?? true
    ]);
    await pool.query(
        `INSERT INTO molam_admin_audit(actor_id, action, target) VALUES ($1, 'tenant.create', $2)`,
        [actorId, rows[0]]
    );
    return rows[0];
}

export async function listTenants() {
    const { rows } = await pool.query(`SELECT * FROM molam_tenants ORDER BY code`);
    return rows;
}

export async function updateTenantModule(tenantId: string, module: string, dto: any, actorId: string) {
    const up = `
    INSERT INTO molam_tenant_modules(tenant_id, module_scope, status, maintenance_message, updated_by, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (tenant_id, module_scope) DO UPDATE SET
      status = EXCLUDED.status,
      maintenance_message = EXCLUDED.maintenance_message,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *`;
    const { rows } = await pool.query(up, [tenantId, module, dto.status, dto.maintenance_message ?? null, actorId]);
    await pool.query(`INSERT INTO molam_admin_audit(actor_id, action, target) VALUES ($1, 'module.status.update', $2)`, [actorId, rows[0]]);
    return rows[0];
}

export async function upsertPolicy(dto: any, actorId: string) {
    const { rows } = await pool.query(
        `INSERT INTO molam_policies(tenant_id, module_scope, key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), module_scope, key)
     DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
        [dto.tenant_id ?? null, dto.module_scope, dto.key, dto.value, actorId]
    );
    await pool.query(`INSERT INTO molam_admin_audit(actor_id, action, target) VALUES ($1, 'policy.upsert', $2)`, [actorId, rows[0]]);
    return rows[0];
}

export async function createLock(dto: any, actorId: string) {
    const { rows } = await pool.query(
        `INSERT INTO molam_emergency_locks(scope, tenant_id, module_scope, role_id, reason, ttl_seconds, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [dto.scope, dto.tenant_id ?? null, dto.module_scope ?? null, dto.role_id ?? null, dto.reason, dto.ttl_seconds, actorId]
    );
    await pool.query(`INSERT INTO molam_admin_audit(actor_id, action, target) VALUES ($1, 'lock.create', $2)`, [actorId, rows[0]]);
    return rows[0];
}

export async function registerKey(kid: string, alg: string, status: 'active' | 'staging' | 'retiring' | 'retired', actorId: string) {
    const { rows } = await pool.query(
        `INSERT INTO molam_key_registry(kid, alg, status, rotated_by, rotated_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3 IN ('staging', 'retiring') THEN NOW() ELSE NULL END)
     ON CONFLICT (kid) DO UPDATE SET status = EXCLUDED.status, rotated_by = EXCLUDED.rotated_by, rotated_at = EXCLUDED.rotated_at
     RETURNING *`,
        [kid, alg, status, actorId]
    );
    await pool.query(`INSERT INTO molam_admin_audit(actor_id, action, target) VALUES ($1, 'key.register_or_update', $2)`, [actorId, rows[0]]);
    return rows[0];
}