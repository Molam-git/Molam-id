/**
 * Brique 5 - Logout v2 with session revocation
 * Enhanced logout that revokes current session and tokens
 */

import { pool } from '../../db.js';
import crypto from 'crypto';

/**
 * POST /api/id/logout
 * Logout and revoke current session
 * Requires authentication (JWT in Authorization header)
 */
export async function logoutV2(req, res) {
  const { refresh_token } = req.body;
  const userId = req.user?.user_id; // Set by requireAuth middleware

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let sessionId = null;

    // If refresh token provided, revoke that specific session
    if (refresh_token) {
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refresh_token)
        .digest('hex');

      const sessionResult = await pool.query(
        `UPDATE molam_sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND refresh_token_hash = $2
           AND revoked_at IS NULL
         RETURNING id`,
        [userId, refreshTokenHash]
      );

      if (sessionResult.rows.length > 0) {
        sessionId = sessionResult.rows[0].id;
      }
    } else {
      // If no refresh token provided, try to revoke the most recent active session
      const sessionResult = await pool.query(
        `UPDATE molam_sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND revoked_at IS NULL
         RETURNING id
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (sessionResult.rows.length > 0) {
        sessionId = sessionResult.rows[0].id;
      }
    }

    // Add access token to revoked tokens list (optional - for immediate invalidation)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      const tokenHash = crypto
        .createHash('sha256')
        .update(accessToken)
        .digest('hex');

      await pool.query(
        `INSERT INTO molam_revoked_tokens (token_hash, user_id, revoked_at, expires_at)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 hour')
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, userId]
      );
    }

    // Log logout
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        userId,
        'logout',
        {
          session_id: sessionId,
          revoked_at: new Date().toISOString()
        }
      ]
    );

    return res.status(200).json({
      message: 'Logout successful',
      session_revoked: sessionId !== null
    });

  } catch (error) {
    console.error('Logout v2 error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
