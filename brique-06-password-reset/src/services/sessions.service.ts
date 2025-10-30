// src/services/sessions.service.ts
import { pool } from './db.js';

/**
 * Invalidate user sessions after password/PIN reset
 * @param userId - User ID
 * @param channel - Optional: only invalidate specific channel ('ussd', 'web', 'app', 'api')
 */
export async function invalidateUserSessions(userId: string, channel?: string): Promise<void> {
  if (channel) {
    // Invalidate only sessions for specific channel
    await pool.query(
      `UPDATE molam_sessions
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND channel = $2 AND is_active = TRUE`,
      [userId, channel]
    );
  } else {
    // Invalidate all active sessions
    await pool.query(
      `UPDATE molam_sessions
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );
  }

  console.log(`[Sessions] Invalidated sessions for user ${userId}${channel ? ` (channel: ${channel})` : ''}`);
}
