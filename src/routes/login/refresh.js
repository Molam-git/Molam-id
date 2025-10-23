/**
 * Brique 5 - Token refresh with rotation
 * Refreshes access token and optionally rotates refresh token
 */

import { pool } from '../../db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const ENABLE_REFRESH_TOKEN_ROTATION = process.env.ENABLE_REFRESH_TOKEN_ROTATION === 'true';

/**
 * POST /api/id/refresh
 * Refresh access token using refresh token
 */
export async function refreshTokens(req, res) {
  const { refresh_token } = req.body;

  try {
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refresh_token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Hash refresh token to find session
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refresh_token)
      .digest('hex');

    // Find active session
    const sessionResult = await pool.query(
      `SELECT * FROM molam_sessions
       WHERE user_id = $1
         AND refresh_token_hash = $2
         AND expires_at > NOW()
         AND revoked_at IS NULL`,
      [decoded.user_id, refreshTokenHash]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Session not found or expired',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const session = sessionResult.rows[0];

    // Get user details
    const userResult = await pool.query(
      'SELECT * FROM molam_users WHERE id = $1',
      [decoded.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if user is still active
    if (user.user_status !== 'active') {
      return res.status(403).json({
        error: 'Account is not active',
        status: user.user_status
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        user_id: user.id,
        molam_id: user.molam_id,
        email: user.email,
        role: user.user_role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const response = {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 minutes in seconds
    };

    // Optional: Refresh token rotation for enhanced security
    if (ENABLE_REFRESH_TOKEN_ROTATION) {
      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        {
          user_id: user.id,
          molam_id: user.molam_id,
          device_id: session.device_id
        },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      const newRefreshTokenHash = crypto
        .createHash('sha256')
        .update(newRefreshToken)
        .digest('hex');

      const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Update session with new refresh token
      await pool.query(
        `UPDATE molam_sessions
         SET refresh_token_hash = $1,
             expires_at = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newRefreshTokenHash, newRefreshExpiresAt, session.id]
      );

      response.refresh_token = newRefreshToken;
    } else {
      // Return the same refresh token
      response.refresh_token = refresh_token;
    }

    // Log token refresh
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        user.id,
        'token_refresh',
        {
          session_id: session.id,
          device_id: session.device_id,
          rotation_enabled: ENABLE_REFRESH_TOKEN_ROTATION
        }
      ]
    );

    return res.status(200).json(response);

  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
