/**
 * Molam ID - RBAC Utility (simplified)
 */
import { query } from '../repo';

export async function checkPermission(
  userId: string,
  permCode: string,
  context: any = {}
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT DISTINCT p.code
       FROM molam_user_roles ur
       JOIN molam_role_permissions rp ON rp.role_id = ur.role_id
       JOIN molam_permissions p ON p.id = rp.perm_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         AND (p.code = $2 OR p.code = '*')`,
      [userId, permCode]
    );

    return result.rows.length > 0;
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}
