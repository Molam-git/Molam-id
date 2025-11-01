/**
 * Authentication Middleware
 * Verifies JWT tokens and populates req.user
 */

import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware: requireAuth
 * Verifies JWT token and ensures user is authenticated
 * Sets req.user with decoded token payload
 */
export async function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    console.log('🔐 Auth middleware - Header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth failed: No token provided');
      return res.status(401).json({
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔐 Token extracted, length:', token.length);

    // Check if token is revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const revokedCheck = await pool.query(
      `SELECT 1 FROM molam_revoked_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (revokedCheck.rows.length > 0) {
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token verified, user_id:', decoded.user_id);
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Verify user still exists and is active
    console.log('🔍 Looking up user:', decoded.user_id);
    const userResult = await pool.query(
      'SELECT id, molam_id, email, user_type, status FROM molam_users WHERE id = $1',
      [decoded.user_id]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found in database');
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];
    console.log('👤 User found:', user.id, 'Status:', user.status);

    if (user.status !== 'active') {
      console.log('❌ User not active:', user.status);
      return res.status(403).json({
        error: 'Account is not active',
        code: 'ACCOUNT_INACTIVE',
        status: user.status
      });
    }

    // Attach user to request
    req.user = {
      user_id: user.id,
      molam_id: user.molam_id,
      email: user.email,
      role: user.user_type
    };

    console.log('✅ Auth successful for user:', user.id);
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware: optionalAuth
 * Similar to requireAuth but doesn't fail if no token provided
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.substring(7);

    // Check if token is revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const revokedCheck = await pool.query(
      `SELECT 1 FROM molam_revoked_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (revokedCheck.rows.length > 0) {
      // Token revoked, continue without user
      return next();
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      // Invalid or expired token, continue without user
      return next();
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT id, molam_id, email, user_type, status FROM molam_users WHERE id = $1',
      [decoded.user_id]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].status === 'active') {
      const user = userResult.rows[0];
      req.user = {
        user_id: user.id,
        molam_id: user.molam_id,
        email: user.email,
        role: user.user_type
      };
    }

    next();

  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // On error, continue without user
    next();
  }
}
