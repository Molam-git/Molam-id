/**
 * Molam ID - Admin Repository
 * Database operations for admin management
 */
import { query } from '../repo';
import {
  TenantDTO,
  TenantRecord,
  TenantModuleRecord,
  PolicyDTO,
  PolicyRecord,
  LockDTO,
  LockRecord,
  KeyRecord,
  ModuleUpdateDTO,
} from '../types';

/**
 * Create a new tenant
 */
export async function createTenant(dto: TenantDTO, actorId: string): Promise<TenantRecord> {
  const sql = `
    INSERT INTO molam_tenants (
      code, name, default_currency, timezone,
      phone_country_code, email_regex, phone_regex,
      is_active, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const { rows } = await query(sql, [
    dto.code.toUpperCase(),
    dto.name,
    dto.default_currency,
    dto.timezone,
    dto.phone_country_code,
    dto.email_regex,
    dto.phone_regex,
    dto.is_active ?? true,
    JSON.stringify(dto.metadata || {}),
  ]);

  // Audit log
  await query(
    `INSERT INTO molam_admin_audit (actor_id, action, target)
     VALUES ($1, 'tenant.create', $2)`,
    [actorId, JSON.stringify(rows[0])]
  );

  return rows[0];
}

/**
 * List all tenants
 */
export async function listTenants(): Promise<TenantRecord[]> {
  const { rows } = await query(`SELECT * FROM molam_tenants ORDER BY code`);
  return rows;
}

/**
 * Get tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<TenantRecord | null> {
  const { rows } = await query(`SELECT * FROM molam_tenants WHERE id = $1`, [tenantId]);
  return rows[0] || null;
}

/**
 * Get tenant by code
 */
export async function getTenantByCode(code: string): Promise<TenantRecord | null> {
  const { rows } = await query(`SELECT * FROM molam_tenants WHERE code = $1`, [code.toUpperCase()]);
  return rows[0] || null;
}

/**
 * Update tenant module status
 */
export async function updateTenantModule(
  tenantId: string,
  module: string,
  dto: ModuleUpdateDTO,
  actorId: string
): Promise<TenantModuleRecord> {
  const sql = `
    INSERT INTO molam_tenant_modules (
      tenant_id, module_scope, status,
      maintenance_message, updated_by, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (tenant_id, module_scope) DO UPDATE SET
      status = EXCLUDED.status,
      maintenance_message = EXCLUDED.maintenance_message,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await query(sql, [
    tenantId,
    module,
    dto.status,
    dto.maintenance_message ?? null,
    actorId,
  ]);

  // Audit log
  await query(
    `INSERT INTO molam_admin_audit (actor_id, action, target)
     VALUES ($1, 'module.status.update', $2)`,
    [actorId, JSON.stringify(rows[0])]
  );

  return rows[0];
}

/**
 * Get tenant modules
 */
export async function getTenantModules(tenantId: string): Promise<TenantModuleRecord[]> {
  const { rows } = await query(
    `SELECT * FROM molam_tenant_modules WHERE tenant_id = $1 ORDER BY module_scope`,
    [tenantId]
  );
  return rows;
}

/**
 * Upsert a policy
 */
export async function upsertPolicy(dto: PolicyDTO, actorId: string): Promise<PolicyRecord> {
  const sql = `
    INSERT INTO molam_policies (
      tenant_id, module_scope, key, value,
      description, updated_by, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (COALESCE(tenant_id::TEXT, '00000000-0000-0000-0000-000000000000'), module_scope, key)
    DO UPDATE SET
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await query(sql, [
    dto.tenant_id ?? null,
    dto.module_scope,
    dto.key,
    JSON.stringify(dto.value),
    dto.description ?? null,
    actorId,
  ]);

  // Audit log
  await query(
    `INSERT INTO molam_admin_audit (actor_id, action, target)
     VALUES ($1, 'policy.upsert', $2)`,
    [actorId, JSON.stringify(rows[0])]
  );

  return rows[0];
}

/**
 * Get policy value
 */
export async function getPolicyValue(
  tenantId: string | null,
  moduleScope: string,
  key: string
): Promise<any> {
  const { rows } = await query(
    `SELECT get_policy_value($1, $2, $3) AS value`,
    [tenantId, moduleScope, key]
  );
  return rows[0]?.value ?? null;
}

/**
 * List policies
 */
export async function listPolicies(filters?: {
  tenant_id?: string | null;
  module_scope?: string;
}): Promise<PolicyRecord[]> {
  let sql = `SELECT * FROM molam_policies WHERE 1=1`;
  const params: any[] = [];

  if (filters?.tenant_id !== undefined) {
    params.push(filters.tenant_id);
    sql += ` AND tenant_id ${filters.tenant_id === null ? 'IS NULL' : `= $${params.length}`}`;
  }

  if (filters?.module_scope) {
    params.push(filters.module_scope);
    sql += ` AND module_scope = $${params.length}`;
  }

  sql += ` ORDER BY module_scope, key`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Create an emergency lock
 */
export async function createLock(dto: LockDTO, actorId: string): Promise<LockRecord> {
  const sql = `
    INSERT INTO molam_emergency_locks (
      scope, tenant_id, module_scope, role_id,
      reason, ttl_seconds, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const { rows } = await query(sql, [
    dto.scope,
    dto.tenant_id ?? null,
    dto.module_scope ?? null,
    dto.role_id ?? null,
    dto.reason,
    dto.ttl_seconds,
    actorId,
  ]);

  // Audit log
  await query(
    `INSERT INTO molam_admin_audit (actor_id, action, target, reason)
     VALUES ($1, 'lock.create', $2, $3)`,
    [actorId, JSON.stringify(rows[0]), dto.reason]
  );

  return rows[0];
}

/**
 * List active locks
 */
export async function listActiveLocks(): Promise<LockRecord[]> {
  const { rows } = await query(
    `SELECT * FROM molam_emergency_locks
     WHERE expires_at > NOW()
     ORDER BY created_at DESC`
  );
  return rows;
}

/**
 * Delete a lock by ID
 */
export async function deleteLock(lockId: string, actorId: string): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM molam_emergency_locks WHERE id = $1`,
    [lockId]
  );

  if (rowCount && rowCount > 0) {
    await query(
      `INSERT INTO molam_admin_audit (actor_id, action, target)
       VALUES ($1, 'lock.delete', $2)`,
      [actorId, JSON.stringify({ lock_id: lockId })]
    );
    return true;
  }

  return false;
}

/**
 * Check if locked
 */
export async function isLocked(
  tenantId?: string,
  moduleScope?: string,
  roleIds?: string[]
): Promise<boolean> {
  const { rows } = await query(
    `SELECT is_locked($1, $2, $3) AS locked`,
    [tenantId ?? null, moduleScope ?? null, roleIds ?? []]
  );
  return rows[0]?.locked ?? false;
}

/**
 * Register or update a key
 */
export async function registerKey(
  kid: string,
  alg: string,
  status: 'active' | 'staging' | 'retiring' | 'retired',
  actorId: string,
  publicKeyPem?: string
): Promise<KeyRecord> {
  const sql = `
    INSERT INTO molam_key_registry (kid, alg, key_type, status, public_key_pem, rotated_by, rotated_at)
    VALUES ($1, $2, 'jwt', $3, $4, $5, CASE WHEN $3 IN ('staging', 'retiring') THEN NOW() ELSE NULL END)
    ON CONFLICT (kid) DO UPDATE SET
      status = EXCLUDED.status,
      rotated_by = EXCLUDED.rotated_by,
      rotated_at = EXCLUDED.rotated_at,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await query(sql, [kid, alg, status, publicKeyPem ?? null, actorId]);

  // Audit log
  await query(
    `INSERT INTO molam_admin_audit (actor_id, action, target)
     VALUES ($1, 'key.register_or_update', $2)`,
    [actorId, JSON.stringify(rows[0])]
  );

  return rows[0];
}

/**
 * List keys
 */
export async function listKeys(status?: string): Promise<KeyRecord[]> {
  let sql = `SELECT * FROM molam_key_registry WHERE 1=1`;
  const params: any[] = [];

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Get active keys for JWKS
 */
export async function getActiveKeys(): Promise<KeyRecord[]> {
  const { rows } = await query(`SELECT * FROM v_active_keys`);
  return rows;
}

/**
 * Export admin audit
 */
export async function exportAdminAudit(filters?: {
  from?: Date;
  to?: Date;
  action_filter?: string;
}): Promise<any[]> {
  let sql = `SELECT * FROM molam_admin_audit WHERE 1=1`;
  const params: any[] = [];

  if (filters?.from) {
    params.push(filters.from);
    sql += ` AND created_at >= $${params.length}`;
  }

  if (filters?.to) {
    params.push(filters.to);
    sql += ` AND created_at <= $${params.length}`;
  }

  if (filters?.action_filter) {
    params.push(`%${filters.action_filter}%`);
    sql += ` AND action ILIKE $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT 10000`;

  const { rows } = await query(sql, params);
  return rows;
}
