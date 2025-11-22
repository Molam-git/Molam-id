/**
 * Brique 5 - Login v2 with 2FA and device binding
 * Enhanced login flow with device fingerprinting and optional 2FA
 */

import { pool } from '../../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { verifyPasswordWithPepper, normalizePhone } from '../../utils/security.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Generate device fingerprint from user agent and IP
 */
function generateDeviceFingerprint(userAgent, ip) {
  const data = `${userAgent}:${ip}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * POST /api/id/login
 * Enhanced login with device binding and optional 2FA
 */
export async function loginV2(req, res) {
  const { email, password, phone, device_info } = req.body;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    console.log('🔐 Login attempt:', { phone, email, hasPassword: !!password });

    // Validate input
    if ((!email && !phone) || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({
        error: 'Email/phone and password are required'
      });
    }

    // Find user by email or phone
    let query, params;
    if (email) {
      query = 'SELECT * FROM molam_users WHERE email = $1';
      params = [email.toLowerCase()];
    } else {
      // Normalize phone number (e.g., 771234567 -> +221771234567)
      const normalizedPhone = normalizePhone(phone);
      query = 'SELECT * FROM molam_users WHERE phone_e164 = $1';
      params = [normalizedPhone];
      console.log('📱 Phone normalized:', phone, '->', normalizedPhone);
    }

    console.log('🔍 Searching user with:', { query, params });
    const userResult = await pool.query(query, params);
    console.log('👤 User found:', userResult.rows.length > 0 ? 'YES' : 'NO');

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account is not active',
        status: user.status
      });
    }

    // Verify password (with pepper like signup)
    console.log('🔑 Verifying password with pepper...');
    const passwordMatch = await verifyPasswordWithPepper(password, user.password_hash);
    console.log('🔑 Password match:', passwordMatch ? 'YES ✅' : 'NO ❌');

    if (!passwordMatch) {
      console.log('❌ Login failed: Invalid password');
      // Log failed login attempt
      await pool.query(
        `INSERT INTO molam_audit_logs (action, actor_id, target_id, metadata)
         VALUES ($1, $2, $3, $4)`,
        ['login_failed', user.id, user.id, JSON.stringify({ reason: 'invalid_password', ip, user_agent: userAgent })]
      );

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Password verified successfully');

    // Generate device fingerprint
    const deviceId = generateDeviceFingerprint(userAgent, ip);

    // TODO: Check if 2FA is enabled for this user
    // If enabled, send 2FA code and return requires_2fa: true
    // For now, we skip 2FA

    // Generate tokens
    const accessToken = jwt.sign(
      {
        user_id: user.id,
        molam_id: user.molam_id,
        email: user.email,
        roles: user.role_profile || []
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        user_id: user.id,
        molam_id: user.molam_id,
        device_id: deviceId
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Hash refresh token for storage
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Calculate expiration dates
    const accessExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create session with device binding
    const sessionId = uuidv4();
    await pool.query(
      `INSERT INTO molam_sessions (id, user_id, refresh_token_hash, device_id, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        user.id,
        refreshTokenHash,
        deviceId,
        refreshExpiresAt,
        {
          user_agent: userAgent,
          ip,
          device_info: device_info || {},
          login_at: new Date().toISOString()
        }
      ]
    );

    // Log successful login
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        user.id,
        'login_success',
        {
          session_id: sessionId,
          device_id: deviceId,
          ip,
          user_agent: userAgent
        }
      ]
    );

    // Parse metadata to get firstName and lastName
    const metadata = typeof user.metadata === 'string' ? JSON.parse(user.metadata) : user.metadata;

    console.log('✅ Login successful - Returning user data:', {
      id: user.id,
      email: user.email,
      phone: user.phone_e164,
      given_name: metadata?.firstName,
      family_name: metadata?.lastName,
      created_at: user.created_at
    });

    return res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 minutes in seconds
      session_id: sessionId,
      user: {
        user_id: user.id,
        id: user.id,
        molam_id: user.molam_id,
        email: user.email,
        phone: user.phone_e164,
        phone_number: user.phone_e164,
        roles: user.role_profile || [],
        kyc_status: user.kyc_status,
        created_at: user.created_at,
        profile: {
          given_name: metadata?.firstName,
          family_name: metadata?.lastName,
        }
      }
    });

  } catch (error) {
    console.error('Login v2 error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
