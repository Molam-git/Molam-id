/**
 * Brique 5 - Session Management
 * List, view, and revoke user sessions across devices
 */

import { pool } from '../../db.js';

/**
 * GET /api/id/sessions
 * List all active sessions for authenticated user
 * Requires authentication
 */
export async function getSessions(req, res) {
  const userId = req.user?.user_id; // Set by requireAuth middleware

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionsResult = await pool.query(
      `SELECT
         id,
         device_id,
         created_at,
         expires_at,
         revoked_at,
         metadata
       FROM molam_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const sessions = sessionsResult.rows.map(session => ({
      id: session.id,
      device_id: session.device_id,
      is_active: session.revoked_at === null && session.expires_at > new Date(),
      created_at: session.created_at,
      expires_at: session.expires_at,
      revoked_at: session.revoked_at,
      device_info: {
        user_agent: session.metadata?.user_agent || 'unknown',
        ip: session.metadata?.ip || 'unknown',
        device_type: session.metadata?.device_info?.device_type || 'unknown'
      }
    }));

    return res.status(200).json({
      total: sessions.length,
      active: sessions.filter(s => s.is_active).length,
      sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/sessions/:id/revoke
 * Revoke a specific session by ID
 * Requires authentication
 */
export async function revokeSessionById(req, res) {
  const { id: sessionId } = req.params;
  const userId = req.user?.user_id; // Set by requireAuth middleware

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Revoke session (only if it belongs to the user)
    const result = await pool.query(
      `UPDATE molam_sessions
       SET revoked_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
       RETURNING id, device_id`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found or already revoked'
      });
    }

    const session = result.rows[0];

    // Log session revocation
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        userId,
        'session_revoked',
        {
          session_id: session.id,
          device_id: session.device_id,
          revoked_at: new Date().toISOString()
        }
      ]
    );

    return res.status(200).json({
      message: 'Session revoked successfully',
      session_id: session.id
    });

  } catch (error) {
    console.error('Revoke session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/sessions/revoke-all
 * Revoke all sessions for authenticated user (logout from all devices)
 * Requires authentication
 */
export async function revokeAllSessions(req, res) {
  const userId = req.user?.user_id; // Set by requireAuth middleware
  const { except_current } = req.body; // Optional: keep current session active

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let query, params;

    if (except_current && req.session_id) {
      // Revoke all sessions except the current one
      query = `UPDATE molam_sessions
               SET revoked_at = NOW()
               WHERE user_id = $1
                 AND id != $2
                 AND revoked_at IS NULL
               RETURNING id`;
      params = [userId, req.session_id];
    } else {
      // Revoke all sessions
      query = `UPDATE molam_sessions
               SET revoked_at = NOW()
               WHERE user_id = $1
                 AND revoked_at IS NULL
               RETURNING id`;
      params = [userId];
    }

    const result = await pool.query(query, params);
    const revokedCount = result.rows.length;

    // Log bulk session revocation
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        userId,
        'sessions_revoked_all',
        {
          revoked_count: revokedCount,
          except_current: except_current || false,
          revoked_at: new Date().toISOString()
        }
      ]
    );

    return res.status(200).json({
      message: 'All sessions revoked successfully',
      revoked_count: revokedCount
    });

  } catch (error) {
    console.error('Revoke all sessions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
