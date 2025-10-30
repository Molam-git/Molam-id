import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../services/db.js';
import { normalizeIdentity, detectCountry } from '../utils/phone.js';
import { issueOTP, verifyOTP, markVerified, markConsumed } from '../services/otp.service.js';
import { sms, email } from '../services/notifications.service.js';
import { invalidateUserSessions } from '../services/sessions.service.js';
import { hashSecret } from '../utils/crypto.js';
import { rateLimitPasswordForgot, rateLimitPinForgot } from '../middlewares/rateLimit.js';
import { env } from '../config/env.js';
import { t } from '../utils/i18n.js';

const router = express.Router();

// ============================================================================
// PASSWORD RESET ROUTES
// ============================================================================

/**
 * POST /api/id/password/forgot
 * Initiate password reset (send OTP)
 */
router.post('/password/forgot', rateLimitPasswordForgot, async (req, res) => {
  try {
    const { identity } = req.body;

    if (!identity) {
      return res.status(400).json({ error: 'identity required' });
    }

    // Normalize identity (email or phone E.164)
    const id = normalizeIdentity(identity);

    // Find user
    const userQuery = id.type === 'email'
      ? 'SELECT * FROM molam_users WHERE email = $1'
      : 'SELECT * FROM molam_users WHERE phone_e164 = $1';

    const { rows: users } = await pool.query(userQuery, [id.value]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];
    const lang = user.language || env.DEFAULT_LANG;
    const country = user.country_code || id.country;

    // Issue OTP
    const { requestId, otp, expires } = await issueOTP(
      user.id,
      id.type === 'email' ? 'email' : 'sms',
      'password',
      country
    );

    // Send notification
    if (id.type === 'email') {
      await email.send(user.email, otp, 'password', lang);
    } else {
      await sms.send(user.phone_e164, otp, lang, country);
    }

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs (target_user_id, action, module, metadata, country_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'PASSWORD_RESET_REQUEST', 'id', JSON.stringify({ channel: id.type }), country]
    );

    return res.status(202).json({
      status: 'accepted',
      expires_at: expires.toISOString()
    });
  } catch (err) {
    console.error('Password forgot error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/id/password/verify
 * Verify OTP code
 */
router.post('/password/verify', async (req, res) => {
  try {
    const { identity, otp } = req.body;

    if (!identity || !otp) {
      return res.status(400).json({ error: 'identity and otp required' });
    }

    // Normalize identity
    const id = normalizeIdentity(identity);

    // Find user
    const userQuery = id.type === 'email'
      ? 'SELECT id FROM molam_users WHERE email = $1'
      : 'SELECT id FROM molam_users WHERE phone_e164 = $1';

    const { rows: users } = await pool.query(userQuery, [id.value]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];

    // Find pending reset request
    const { rows: requests } = await pool.query(
      `SELECT id FROM molam_reset_requests
       WHERE user_id = $1 AND kind = 'password' AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (requests.length === 0) {
      return res.status(400).json({ error: 'NO_PENDING_REQUEST' });
    }

    const requestId = requests[0].id;

    // Verify OTP
    const valid = await verifyOTP(requestId, otp);

    if (!valid) {
      return res.status(401).json({ error: 'OTP_INVALID' });
    }

    // Mark as verified
    await markVerified(requestId);

    // Generate reset token (JWT, 15 min TTL)
    const resetToken = jwt.sign(
      { uid: user.id, kind: 'password', rrid: requestId },
      env.JWT_RESET_SECRET,
      { expiresIn: env.JWT_RESET_TTL_S }
    );

    return res.json({ reset_token: resetToken });
  } catch (err) {
    console.error('Password verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/id/password/confirm
 * Set new password
 */
router.post('/password/confirm', async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;

    if (!reset_token || !new_password) {
      return res.status(400).json({ error: 'reset_token and new_password required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify JWT
    let payload;
    try {
      payload = jwt.verify(reset_token, env.JWT_RESET_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'TOKEN_INVALID' });
    }

    if (payload.kind !== 'password') {
      return res.status(400).json({ error: 'TOKEN_KIND_INVALID' });
    }

    // Hash new password
    const passwordHash = await hashSecret(new_password);

    // Update password
    await pool.query(
      `UPDATE molam_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, payload.uid]
    );

    // Mark request as consumed
    await markConsumed(payload.rrid);

    // Invalidate all active sessions
    await invalidateUserSessions(payload.uid);

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs (target_user_id, action, module)
       VALUES ($1, $2, $3)`,
      [payload.uid, 'PASSWORD_RESET_CONFIRMED', 'id']
    );

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Password confirm error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PIN USSD RESET ROUTES (app/web)
// ============================================================================

/**
 * POST /api/id/ussd/pin/reset/start
 * Initiate PIN reset (send OTP)
 */
router.post('/ussd/pin/reset/start', rateLimitPinForgot, async (req, res) => {
  try {
    const { identity } = req.body;

    if (!identity) {
      return res.status(400).json({ error: 'identity required' });
    }

    const id = normalizeIdentity(identity);

    const userQuery = id.type === 'email'
      ? 'SELECT * FROM molam_users WHERE email = $1'
      : 'SELECT * FROM molam_users WHERE phone_e164 = $1';

    const { rows: users } = await pool.query(userQuery, [id.value]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];
    const lang = user.language || env.DEFAULT_LANG;
    const country = user.country_code || id.country;

    const { requestId, otp, expires } = await issueOTP(
      user.id,
      id.type === 'email' ? 'email' : 'sms',
      'ussd_pin',
      country
    );

    if (id.type === 'email') {
      await email.send(user.email, otp, 'ussd_pin', lang);
    } else {
      await sms.send(user.phone_e164, otp, lang, country);
    }

    await pool.query(
      `INSERT INTO molam_audit_logs (target_user_id, action, module, metadata, country_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'PIN_RESET_REQUEST', 'id', JSON.stringify({ channel: id.type }), country]
    );

    return res.status(202).json({
      status: 'accepted',
      expires_at: expires.toISOString()
    });
  } catch (err) {
    console.error('PIN reset start error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/id/ussd/pin/reset/verify
 * Verify OTP for PIN reset
 */
router.post('/ussd/pin/reset/verify', async (req, res) => {
  try {
    const { identity, otp } = req.body;

    if (!identity || !otp) {
      return res.status(400).json({ error: 'identity and otp required' });
    }

    const id = normalizeIdentity(identity);

    const userQuery = id.type === 'email'
      ? 'SELECT id FROM molam_users WHERE email = $1'
      : 'SELECT id FROM molam_users WHERE phone_e164 = $1';

    const { rows: users } = await pool.query(userQuery, [id.value]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];

    const { rows: requests } = await pool.query(
      `SELECT id FROM molam_reset_requests
       WHERE user_id = $1 AND kind = 'ussd_pin' AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (requests.length === 0) {
      return res.status(400).json({ error: 'NO_PENDING_REQUEST' });
    }

    const requestId = requests[0].id;
    const valid = await verifyOTP(requestId, otp);

    if (!valid) {
      return res.status(401).json({ error: 'OTP_INVALID' });
    }

    await markVerified(requestId);

    return res.json({ status: 'verified' });
  } catch (err) {
    console.error('PIN verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/id/ussd/pin/reset/confirm
 * Set new PIN
 */
router.post('/ussd/pin/reset/confirm', async (req, res) => {
  try {
    const { identity, new_pin } = req.body;

    if (!identity || !new_pin) {
      return res.status(400).json({ error: 'identity and new_pin required' });
    }

    if (!/^\d{4,6}$/.test(new_pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const id = normalizeIdentity(identity);

    const userQuery = id.type === 'email'
      ? 'SELECT id FROM molam_users WHERE email = $1'
      : 'SELECT id FROM molam_users WHERE phone_e164 = $1';

    const { rows: users } = await pool.query(userQuery, [id.value]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];

    // Check for verified request
    const { rows: requests } = await pool.query(
      `SELECT id FROM molam_reset_requests
       WHERE user_id = $1 AND kind = 'ussd_pin' AND status = 'verified'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (requests.length === 0) {
      return res.status(400).json({ error: 'NO_VERIFIED_REQUEST' });
    }

    // Hash PIN
    const pinHash = await hashSecret(new_pin);

    // Update PIN
    await pool.query(
      `UPDATE molam_users SET ussd_pin_hash = $1, updated_at = NOW() WHERE id = $2`,
      [pinHash, user.id]
    );

    // Mark request as consumed
    await markConsumed(requests[0].id);

    // Invalidate USSD sessions only
    await invalidateUserSessions(user.id, 'ussd');

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs (target_user_id, action, module)
       VALUES ($1, $2, $3)`,
      [user.id, 'PIN_RESET_CONFIRMED', 'id']
    );

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('PIN confirm error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// USSD WEBHOOK (*131*99#)
// ============================================================================

/**
 * POST /api/id/ussd
 * USSD webhook handler for *131*99# (PIN reset)
 */
router.post('/ussd', async (req, res) => {
  try {
    const { msisdn, mccmnc, text, short_code } = req.body;

    const country = detectCountry(mccmnc, msisdn);

    // Find user
    const { rows: users } = await pool.query(
      `SELECT id, language, country_code FROM molam_users WHERE phone_e164 = $1`,
      [msisdn]
    );

    const user = users[0];
    const lang = user?.language || env.DEFAULT_LANG;

    // Route by short code
    if (short_code === '*131#') {
      return res.json({ response: `CON ${t(lang, 'USSD_MENU')}` });
    }

    if (short_code === '*131*1#') {
      return res.json({ response: `END ${t(lang, 'USSD_BALANCE')}` });
    }

    if (short_code === '*131*2#') {
      return res.json({ response: `END ${t(lang, 'USSD_TOPUP')}` });
    }

    if (short_code === '*131*3#') {
      return res.json({ response: `END ${t(lang, 'USSD_TRANSFER')}` });
    }

    // PIN reset flow (*131*99#)
    if (short_code === '*131*99#') {
      if (!user) {
        return res.json({ response: `END ${t(lang, 'USSD_USER_NOT_FOUND')}` });
      }

      const parts = (text || '').split('*').filter(Boolean);

      // Step 0: Issue OTP
      if (parts.length === 0) {
        const { otp } = await issueOTP(user.id, 'ussd', 'ussd_pin', country);
        // Send OTP via SMS (NOT displayed in USSD)
        await sms.send(msisdn, otp, lang, country);
        return res.json({ response: `CON ${t(lang, 'USSD_PIN_RESET_PROMPT')}` });
      }

      // Step 1: Verify OTP
      if (parts.length === 1) {
        const otpInput = parts[0];

        const { rows: requests } = await pool.query(
          `SELECT id FROM molam_reset_requests
           WHERE user_id = $1 AND kind = 'ussd_pin' AND status = 'pending'
           ORDER BY created_at DESC
           LIMIT 1`,
          [user.id]
        );

        if (requests.length === 0) {
          return res.json({ response: `END ${t(lang, 'USSD_NO_REQUEST')}` });
        }

        const valid = await verifyOTP(requests[0].id, otpInput);

        if (!valid) {
          return res.json({ response: `END ${t(lang, 'USSD_CODE_INVALID')}` });
        }

        await markVerified(requests[0].id);
        return res.json({ response: `CON ${t(lang, 'USSD_NEW_PIN')}` });
      }

      // Step 2: Enter new PIN
      if (parts.length === 2) {
        return res.json({ response: `CON ${t(lang, 'USSD_REPEAT_PIN')}` });
      }

      // Step 3: Confirm PIN and save
      if (parts.length >= 3) {
        const pin1 = parts[1];
        const pin2 = parts[2];

        if (!/^\d{4,6}$/.test(pin1) || pin1 !== pin2) {
          return res.json({ response: `END ${t(lang, 'USSD_PIN_MISMATCH')}` });
        }

        const pinHash = await hashSecret(pin1);

        await pool.query(
          `UPDATE molam_users SET ussd_pin_hash = $1, updated_at = NOW() WHERE id = $2`,
          [pinHash, user.id]
        );

        await invalidateUserSessions(user.id, 'ussd');

        await pool.query(
          `INSERT INTO molam_audit_logs (target_user_id, action, module, country_code)
           VALUES ($1, $2, $3, $4)`,
          [user.id, 'USSD_PIN_RESET', 'id', country]
        );

        return res.json({ response: `END ${t(lang, 'USSD_SUCCESS')}` });
      }
    }

    return res.json({ response: `END ${t(lang, 'USSD_UNKNOWN_CODE')}` });
  } catch (err) {
    console.error('USSD webhook error:', err);
    return res.json({ response: 'END Service temporarily unavailable.' });
  }
});

export default router;
