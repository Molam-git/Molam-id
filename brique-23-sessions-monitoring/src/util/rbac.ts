import { Pool } from 'pg';
const pool = new Pool();

export async function checkPermission(userId: string, permCode: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM molam_user_roles ur
       JOIN molam_role_permissions rp ON rp.role_id = ur.role_id
       JOIN molam_permissions p ON p.id = rp.perm_id
       WHERE ur.user_id = $1 AND p.code = $2 LIMIT 1`,
      [userId, permCode]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
