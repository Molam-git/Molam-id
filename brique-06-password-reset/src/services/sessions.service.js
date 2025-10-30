import { pool } from './db.js';

/**
 * Invalidate all active sessions for a user
 * Called after password reset or PIN reset
 * @param {string} userId - User ID
 * @param {string} channel - Optional: specific channel ('web', 'app', 'ussd', 'api')
 */
export async function invalidateUserSessions(userId, channel = null) {
  if (channel) {
    // Invalidate specific channel sessions
    await pool.query(
      `UPDATE molam_sessions
       SET is_active = FALSE
       WHERE user_id = $1 AND channel = $2 AND is_active = TRUE`,
      [userId, channel]
    );

    console.log(`🔒 Invalidated ${channel} sessions for user ${userId}`);
  } else {
    // Invalidate all sessions
    await pool.query(
      `UPDATE molam_sessions
       SET is_active = FALSE
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    console.log(`🔒 Invalidated ALL sessions for user ${userId}`);
  }
}

/**
 * Get active session count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of active sessions
 */
export async function getActiveSessionCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count
     FROM molam_sessions
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  return parseInt(rows[0].count, 10);
}
