import { pool } from './index';
import { RoleDTO } from '../types';

export async function upsertRole(actorId: string, dto: RoleDTO) {
    const q = `
    INSERT INTO molam_roles_v2 (id, name, module_scope, description, trusted_level)
    VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      module_scope = EXCLUDED.module_scope,
      description = EXCLUDED.description,
      trusted_level = EXCLUDED.trusted_level
    RETURNING *;
  `;
    const { rows } = await pool.query(q, [
        dto.id ?? null,
        dto.name,
        dto.module_scope,
        dto.description ?? null,
        dto.trusted_level
    ]);
    return rows[0];
}

export async function addGrant(userId: string, roleId: string, grantedBy: string) {
    const q = `
    INSERT INTO molam_user_roles (user_id, role_id, granted_by)
    VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *;
  `;
    const { rows } = await pool.query(q, [userId, roleId, grantedBy]);
    return rows[0]; // undefined if already existed
}

export async function revokeGrant(userId: string, roleId: string): Promise<boolean> {
    const result = await pool.query(
        `DELETE FROM molam_user_roles WHERE user_id = $1 AND role_id = $2`,
        [userId, roleId]
    );
    // Correction: rowCount peut être null, donc on utilise ?? 0
    return (result.rowCount ?? 0) > 0;
}

export async function getRoleById(roleId: string) {
    const { rows } = await pool.query(`SELECT * FROM molam_roles_v2 WHERE id = $1`, [roleId]);
    return rows[0];
}