// src/middleware/locks.ts
import { pool } from '../repo';

export async function denyIfLocked(ctx: { tenant_id?: string, module_scope?: string, role_ids?: string[] }) {
    const q = `
    SELECT 1 FROM molam_emergency_locks
    WHERE expires_at > NOW()
      AND (
        scope='global'
        OR (scope='tenant' AND tenant_id = $1)
        OR (scope='module' AND tenant_id = $1 AND module_scope = $2)
        OR (scope='role' AND $3 && ARRAY[role_id]::uuid[])
      )
    LIMIT 1`;
    const { rows } = await pool.query(q, [ctx.tenant_id ?? null, ctx.module_scope ?? null, ctx.role_ids ?? []]);
    return !!rows[0];
}