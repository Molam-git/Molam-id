/**
 * Sessions management endpoints
 */

import { pool } from '../../db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to verify JWT token and extract user ID
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.user_id;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * GET /api/id/sessions
 * List all sessions for the current user
 */
export async function listMySessions(req, res) {
  try {
    const userId = req.userId;

    console.log('📋 Fetching sessions for user:', userId);

    const result = await pool.query(
      `SELECT id, device_id, created_at, expires_at, metadata
       FROM molam_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const sessions = result.rows.map(row => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;

      return {
        id: row.id,
        channel: metadata?.channel || 'web',
        device_fingerprint: {
          os: metadata?.user_agent?.includes('Windows') ? 'Windows' :
             metadata?.user_agent?.includes('Mac') ? 'macOS' :
             metadata?.user_agent?.includes('Linux') ? 'Linux' : 'Unknown',
          browser: metadata?.user_agent?.includes('Chrome') ? 'Chrome' :
                  metadata?.user_agent?.includes('Firefox') ? 'Firefox' :
                  metadata?.user_agent?.includes('Safari') ? 'Safari' : 'Unknown'
        },
        geo_country: metadata?.country || 'SN',
        last_seen_at: row.created_at,
        created_at: row.created_at,
        is_active: new Date(row.expires_at) > new Date(),
        is_current: row.id === req.sessionId, // Compare with current session
        anomalies: 0
      };
    });

    console.log('✅ Found sessions:', sessions.length);

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

/**
 * DELETE /api/id/sessions/:sessionId
 * Revoke a specific session
 */
export async function revokeSession(req, res) {
  try {
    const userId = req.userId;
    const sessionId = req.params.sessionId;

    console.log('🗑️ Revoking session:', sessionId, 'for user:', userId);

    // Don't allow revoking current session
    if (sessionId === req.sessionId) {
      return res.status(400).json({ error: 'Cannot revoke current session. Please logout instead.' });
    }

    // Delete the session
    const result = await pool.query(
      `DELETE FROM molam_sessions
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log('✅ Session revoked:', sessionId);

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
}

// Export middleware for use in routes
export { authenticateToken };
