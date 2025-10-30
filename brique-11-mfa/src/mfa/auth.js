import jwt from 'jsonwebtoken';
import { cfg } from './config.js';

/**
 * JWT authentication middleware
 * Extracts and verifies JWT from Authorization header
 */
export function requireJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, cfg.jwtSecret, {
      algorithms: ['HS256', 'RS256']
    });

    // Attach user info to request
    req.user = {
      user_id: decoded.user_id || decoded.sub,
      email: decoded.email,
      phone: decoded.phone,
      roles: decoded.roles || [],
      mfa_verified: decoded.mfa_verified || false
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        expired_at: err.expiredAt
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      error: 'Token verification failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Optional JWT middleware (doesn't fail if no token)
 */
export function optionalJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, cfg.jwtSecret, {
      algorithms: ['HS256', 'RS256']
    });

    req.user = {
      user_id: decoded.user_id || decoded.sub,
      email: decoded.email,
      phone: decoded.phone,
      roles: decoded.roles || []
    };
  } catch (err) {
    req.user = null;
  }

  next();
}

/**
 * Require MFA verification in token
 */
export function requireMFA(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  if (!req.user.mfa_verified) {
    return res.status(403).json({
      error: 'MFA verification required',
      code: 'MFA_REQUIRED',
      challenge_url: '/api/mfa/challenge'
    });
  }

  next();
}

/**
 * Generate MFA challenge token (short-lived)
 * @param {string} userId - User ID
 * @param {string} challengeId - Challenge ID
 * @returns {string} - JWT token
 */
export function generateChallengeToken(userId, challengeId) {
  return jwt.sign(
    {
      user_id: userId,
      challenge_id: challengeId,
      type: 'mfa_challenge'
    },
    cfg.jwtSecret,
    { expiresIn: '5m' } // 5 minutes
  );
}

/**
 * Generate MFA verified token (to be used after successful MFA)
 * @param {object} user - User object
 * @returns {string} - JWT token with mfa_verified flag
 */
export function generateMFAToken(user) {
  return jwt.sign(
    {
      user_id: user.id || user.user_id,
      email: user.email,
      phone: user.phone,
      roles: user.roles || [],
      mfa_verified: true
    },
    cfg.jwtSecret,
    { expiresIn: '1h' } // 1 hour
  );
}
