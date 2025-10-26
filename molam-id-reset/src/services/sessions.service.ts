import { db } from '../db.js';
export async function invalidateUserSessions(userId: string) {
    await db.query(`UPDATE molam_sessions SET is_active = FALSE WHERE user_id=$1 AND is_active=TRUE`, [userId]);
}
