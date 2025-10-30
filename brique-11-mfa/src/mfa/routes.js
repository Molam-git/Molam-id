import express from 'express';
import { v4 as uuid } from 'uuid';
import { pool, getRedis } from './repo.js';
import { requireJWT, generateChallengeToken, generateMFAToken } from './auth.js';
import { rateLimitOTP, rateLimitVerify, rateLimitEnroll, checkLockout, applyLockout, clearLockout } from './rate.js';
import { generateNumericOTP, hashOTP, verifyOTP, generateRecoveryCodes, hashRecoveryCode } from './crypto.js';
import { createTOTPFactor, verifyTOTP } from './totp.js';
import { encryptSecret, decryptSecret } from './kms.js';
import { sendSMS, sendEmail, sendPushNotification, sendUSSD } from '../adapters/notify.js';
import { cfg } from './config.js';

const router = express.Router();

/**
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mfa', timestamp: new Date().toISOString() });
});

/**
 * POST /api/mfa/enroll
 * Enroll a new MFA factor
 * Body: { factor_type: 'sms_otp' | 'email_otp' | 'totp' | 'webauthn' | 'ussd_pin', channel?, label?, is_primary? }
 */
router.post('/enroll', requireJWT, rateLimitEnroll, async (req, res) => {
  const userId = req.user.user_id;
  const { factor_type, channel, label, is_primary } = req.body || {};

  if (!factor_type) {
    return res.status(400).json({ error: 'factor_type required' });
  }

  const validTypes = ['sms_otp', 'email_otp', 'totp', 'webauthn', 'recovery_code', 'push', 'ussd_pin'];
  if (!validTypes.includes(factor_type)) {
    return res.status(400).json({ error: 'Invalid factor_type', valid_types: validTypes });
  }

  try {
    let secret_enc = null;
    let public_data = {};

    // Generate factor-specific data
    if (factor_type === 'totp') {
      const accountName = req.user.email || req.user.phone || userId;
      const totp = createTOTPFactor(accountName, { issuer: 'Molam-ID' });

      // Encrypt TOTP secret
      secret_enc = await encryptSecret(totp.secret);
      public_data = {
        uri: totp.uri,
        qr_data: totp.qr_data
      };
    } else if (factor_type === 'recovery_code') {
      // Generate recovery codes
      const codes = generateRecoveryCodes(cfg.recoveryCodesCount);

      // Store hashed codes in database
      const codeInserts = codes.map(code => [
        uuid(),
        userId,
        hashRecoveryCode(code),
        false // not used yet
      ]);

      for (const [id, user_id, code_hash, used] of codeInserts) {
        await pool.query(
          `INSERT INTO molam_mfa_recovery_codes (id, user_id, code_hash, used)
           VALUES ($1, $2, $3, $4)`,
          [id, user_id, code_hash, used]
        );
      }

      // Return unhashed codes to user (ONLY once!)
      return res.status(201).json({
        factor_id: uuid(),
        factor_type: 'recovery_code',
        recovery_codes: codes,
        warning: 'Save these codes securely. They will not be shown again.'
      });
    } else if (factor_type === 'ussd_pin') {
      // USSD PIN is just stored as is (user sets it)
      if (!req.body.pin || req.body.pin.length < 4 || req.body.pin.length > 6) {
        return res.status(400).json({ error: 'PIN must be 4-6 digits' });
      }

      const pin_hash = await hashOTP(req.body.pin);
      await pool.query(
        `INSERT INTO molam_ussd_pins (user_id, pin_hash, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET pin_hash = $2, updated_at = NOW(), retry_count = 0, locked_until = NULL`,
        [userId, pin_hash]
      );

      return res.status(201).json({
        factor_id: uuid(),
        factor_type: 'ussd_pin',
        message: 'USSD PIN enrolled successfully'
      });
    } else if (factor_type === 'sms_otp' || factor_type === 'email_otp') {
      // No enrollment needed, will use channel from user profile
      public_data = { channel: channel || (factor_type === 'sms_otp' ? req.user.phone : req.user.email) };
    } else if (factor_type === 'webauthn') {
      // WebAuthn enrollment requires client-side ceremony
      // Return challenge for client to complete
      const challenge = uuid();
      const redis = await getRedis();
      await redis.set(`webauthn:challenge:${userId}`, challenge, { EX: 300 }); // 5 min

      return res.status(200).json({
        factor_type: 'webauthn',
        challenge,
        rp: { name: 'Molam-ID', id: process.env.RP_ID || 'localhost' },
        user: { id: userId, name: req.user.email || req.user.phone, displayName: label || 'User' },
        message: 'Complete WebAuthn registration on client'
      });
    }

    // Insert factor
    const { rows } = await pool.query(
      `INSERT INTO molam_mfa_factors (id, user_id, factor_type, label, secret_enc, public_data, is_primary, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, factor_type, label, public_data, is_primary, created_at`,
      [uuid(), userId, factor_type, label || null, secret_enc, JSON.stringify(public_data), is_primary || false, true]
    );

    // Log enrollment event
    await pool.query(
      `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), userId, 'factor_enrolled', rows[0].id, true, JSON.stringify({ factor_type })]
    );

    return res.status(201).json({
      factor_id: rows[0].id,
      factor_type: rows[0].factor_type,
      label: rows[0].label,
      public_data: rows[0].public_data,
      is_primary: rows[0].is_primary,
      created_at: rows[0].created_at
    });
  } catch (err) {
    console.error('Enroll error:', err);
    return res.status(500).json({ error: 'Enrollment failed' });
  }
});

/**
 * POST /api/mfa/challenge
 * Start MFA challenge (send OTP, initiate push, etc.)
 * Body: { scope?, context? }
 */
router.post('/challenge', requireJWT, rateLimitOTP, async (req, res) => {
  const userId = req.user.user_id;
  const { scope, context } = req.body || {};

  // Check lockout
  const lockout = await checkLockout(userId, 'mfa_challenge');
  if (lockout.locked) {
    return res.status(429).json({
      error: 'Account temporarily locked',
      code: 'LOCKED_OUT',
      retry_after: lockout.retry_after
    });
  }

  try {
    // Get MFA policy for scope
    const policy = await pool.query(
      `SELECT rule FROM molam_mfa_policies WHERE scope = $1`,
      [scope || 'default']
    );

    const rule = policy.rows[0]?.rule || { min_factors: 1, allowed_types: ['sms_otp', 'totp'] };

    // Get user's active factors
    const factors = await pool.query(
      `SELECT id, factor_type, label, public_data, is_primary
       FROM molam_mfa_factors
       WHERE user_id = $1 AND is_active = true
       ORDER BY is_primary DESC, created_at ASC`,
      [userId]
    );

    if (factors.rows.length === 0) {
      return res.status(400).json({
        error: 'No MFA factors enrolled',
        code: 'NO_FACTORS',
        enroll_url: '/api/mfa/enroll'
      });
    }

    // Select primary factor or first available
    const factor = factors.rows[0];
    const challengeId = uuid();

    // Send challenge based on factor type
    if (factor.factor_type === 'sms_otp') {
      const phone = req.user.phone || factor.public_data?.channel;
      if (!phone) {
        return res.status(400).json({ error: 'No phone number available' });
      }

      const code = generateNumericOTP(cfg.otpLength);
      const code_hash = await hashOTP(code);
      const expires_at = new Date(Date.now() + (cfg.otpTtlSec * 1000));

      // Store OTP
      await pool.query(
        `INSERT INTO molam_mfa_otps (id, user_id, channel, code_hash, expires_at, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [challengeId, userId, phone, code_hash, expires_at, cfg.maxOtpAttempts]
      );

      // Send SMS
      const result = await sendSMS(phone, code, cfg.otpTtlSec);

      return res.status(200).json({
        challenge_id: challengeId,
        factor_type: 'sms_otp',
        channel: phone,
        expires_in: cfg.otpTtlSec,
        message: 'OTP sent via SMS',
        ...(process.env.NODE_ENV !== 'production' && result.code && { code: result.code }) // Include code in test/dev mode
      });
    } else if (factor.factor_type === 'email_otp') {
      const email = req.user.email || factor.public_data?.channel;
      if (!email) {
        return res.status(400).json({ error: 'No email address available' });
      }

      const code = generateNumericOTP(cfg.otpLength);
      const code_hash = await hashOTP(code);
      const expires_at = new Date(Date.now() + (cfg.otpTtlSec * 1000));

      await pool.query(
        `INSERT INTO molam_mfa_otps (id, user_id, channel, code_hash, expires_at, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [challengeId, userId, email, code_hash, expires_at, cfg.maxOtpAttempts]
      );

      const result = await sendEmail(email, code, cfg.otpTtlSec);

      return res.status(200).json({
        challenge_id: challengeId,
        factor_type: 'email_otp',
        channel: email,
        expires_in: cfg.otpTtlSec,
        message: 'OTP sent via email',
        ...(process.env.NODE_ENV !== 'production' && result.code && { code: result.code })
      });
    } else if (factor.factor_type === 'totp') {
      // TOTP doesn't need challenge, user provides code directly
      return res.status(200).json({
        challenge_id: challengeId,
        factor_type: 'totp',
        factor_id: factor.id,
        message: 'Enter TOTP code from your authenticator app'
      });
    } else if (factor.factor_type === 'push') {
      // Send push notification
      const deviceToken = factor.public_data?.device_token;
      if (!deviceToken) {
        return res.status(400).json({ error: 'No device token available' });
      }

      await sendPushNotification(userId, deviceToken, context);

      // Store pending approval
      const redis = await getRedis();
      await redis.set(`push:${challengeId}`, 'pending', { EX: 300 }); // 5 min

      return res.status(200).json({
        challenge_id: challengeId,
        factor_type: 'push',
        message: 'Push notification sent. Approve on your device.',
        poll_url: `/api/mfa/challenge/${challengeId}/status`
      });
    }

    return res.status(400).json({ error: 'Unsupported factor type' });
  } catch (err) {
    console.error('Challenge error:', err);
    return res.status(500).json({ error: 'Challenge failed' });
  }
});

/**
 * POST /api/mfa/verify
 * Verify MFA challenge
 * Body: { challenge_id, code?, factor_id? }
 */
router.post('/verify', rateLimitVerify, async (req, res) => {
  const { challenge_id, code, factor_id } = req.body || {};

  if (!challenge_id) {
    return res.status(400).json({ error: 'challenge_id required' });
  }

  try {
    // Check if OTP-based challenge
    const otp = await pool.query(
      `SELECT id, user_id, channel, code_hash, expires_at, attempts, max_attempts, verified_at
       FROM molam_mfa_otps
       WHERE id = $1`,
      [challenge_id]
    );

    if (otp.rows.length > 0) {
      const record = otp.rows[0];

      // Check if already verified
      if (record.verified_at) {
        return res.status(400).json({ error: 'Challenge already verified', code: 'ALREADY_VERIFIED' });
      }

      // Check expiry
      if (new Date() > new Date(record.expires_at)) {
        return res.status(400).json({ error: 'Challenge expired', code: 'EXPIRED' });
      }

      // Check attempts
      if (record.attempts >= record.max_attempts) {
        await applyLockout(record.user_id, 'mfa_verify', 900); // 15 min lockout
        return res.status(429).json({ error: 'Too many attempts', code: 'MAX_ATTEMPTS' });
      }

      // Verify code
      if (!code) {
        return res.status(400).json({ error: 'code required' });
      }

      const valid = await verifyOTP(record.code_hash, code);

      // Increment attempts
      await pool.query(
        `UPDATE molam_mfa_otps SET attempts = attempts + 1 WHERE id = $1`,
        [challenge_id]
      );

      if (!valid) {
        // Log failed attempt
        await pool.query(
          `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuid(), record.user_id, 'verification_failed', null, false, JSON.stringify({ challenge_id, reason: 'invalid_code' })]
        );

        return res.status(401).json({ error: 'Invalid code', code: 'INVALID_CODE' });
      }

      // Mark as verified
      await pool.query(
        `UPDATE molam_mfa_otps SET verified_at = NOW() WHERE id = $1`,
        [challenge_id]
      );

      // Clear lockout
      await clearLockout(record.user_id, 'mfa_verify');

      // Log success
      await pool.query(
        `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuid(), record.user_id, 'verification_success', null, true, JSON.stringify({ challenge_id, channel: record.channel })]
      );

      // Get user info
      const user = await pool.query(
        `SELECT id, email, phone_e164 as phone FROM molam_users WHERE id = $1`,
        [record.user_id]
      );

      // Generate MFA-verified token
      const mfa_token = generateMFAToken(user.rows[0]);

      return res.status(200).json({
        success: true,
        message: 'MFA verification successful',
        mfa_token,
        user_id: record.user_id
      });
    }

    // Check if TOTP-based challenge
    if (factor_id) {
      const factor = await pool.query(
        `SELECT id, user_id, factor_type, secret_enc
         FROM molam_mfa_factors
         WHERE id = $1 AND is_active = true`,
        [factor_id]
      );

      if (factor.rows.length === 0) {
        return res.status(404).json({ error: 'Factor not found' });
      }

      const record = factor.rows[0];

      if (record.factor_type === 'totp') {
        if (!code) {
          return res.status(400).json({ error: 'code required for TOTP' });
        }

        // Decrypt secret
        const secret = await decryptSecret(record.secret_enc);

        // Verify TOTP
        const valid = verifyTOTP(code, secret, cfg.totp);

        if (!valid) {
          // Log failure
          await pool.query(
            `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [uuid(), record.user_id, 'verification_failed', factor_id, false, JSON.stringify({ reason: 'invalid_totp' })]
          );

          return res.status(401).json({ error: 'Invalid TOTP code', code: 'INVALID_CODE' });
        }

        // Log success
        await pool.query(
          `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuid(), record.user_id, 'verification_success', factor_id, true, JSON.stringify({ method: 'totp' })]
        );

        // Get user info
        const user = await pool.query(
          `SELECT id, email, phone_e164 as phone FROM molam_users WHERE id = $1`,
          [record.user_id]
        );

        const mfa_token = generateMFAToken(user.rows[0]);

        return res.status(200).json({
          success: true,
          message: 'TOTP verification successful',
          mfa_token,
          user_id: record.user_id
        });
      }
    }

    return res.status(404).json({ error: 'Challenge not found' });
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/mfa/recovery
 * Use recovery code
 * Body: { user_id, recovery_code }
 */
router.post('/recovery', rateLimitVerify, async (req, res) => {
  const { user_id, recovery_code } = req.body || {};

  if (!user_id || !recovery_code) {
    return res.status(400).json({ error: 'user_id and recovery_code required' });
  }

  try {
    const code_hash = hashRecoveryCode(recovery_code);

    // Find matching code
    const result = await pool.query(
      `SELECT id, used FROM molam_mfa_recovery_codes
       WHERE user_id = $1 AND code_hash = $2`,
      [user_id, code_hash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid recovery code', code: 'INVALID_CODE' });
    }

    if (result.rows[0].used) {
      return res.status(401).json({ error: 'Recovery code already used', code: 'CODE_USED' });
    }

    // Mark as used
    await pool.query(
      `UPDATE molam_mfa_recovery_codes SET used = true, used_at = NOW() WHERE id = $1`,
      [result.rows[0].id]
    );

    // Log recovery code usage
    await pool.query(
      `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), user_id, 'recovery_code_used', null, true, JSON.stringify({ code_id: result.rows[0].id })]
    );

    // Get user info
    const user = await pool.query(
      `SELECT id, email, phone_e164 as phone FROM molam_users WHERE id = $1`,
      [user_id]
    );

    const mfa_token = generateMFAToken(user.rows[0]);

    return res.status(200).json({
      success: true,
      message: 'Recovery code accepted',
      mfa_token,
      warning: 'Consider re-enrolling MFA factors'
    });
  } catch (err) {
    console.error('Recovery error:', err);
    return res.status(500).json({ error: 'Recovery failed' });
  }
});

/**
 * GET /api/mfa/factors
 * List user's MFA factors
 */
router.get('/factors', requireJWT, async (req, res) => {
  const userId = req.user.user_id;

  try {
    const factors = await pool.query(
      `SELECT id, factor_type, label, public_data, is_primary, is_active, created_at, last_used_at
       FROM molam_mfa_factors
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [userId]
    );

    return res.json({
      factors: factors.rows.map(f => ({
        id: f.id,
        factor_type: f.factor_type,
        label: f.label,
        is_primary: f.is_primary,
        is_active: f.is_active,
        created_at: f.created_at,
        last_used_at: f.last_used_at
        // Note: secret_enc is NOT returned
      }))
    });
  } catch (err) {
    console.error('List factors error:', err);
    return res.status(500).json({ error: 'Failed to list factors' });
  }
});

/**
 * DELETE /api/mfa/factors/:id
 * Remove MFA factor
 */
router.delete('/factors/:id', requireJWT, async (req, res) => {
  const userId = req.user.user_id;
  const factorId = req.params.id;

  try {
    // Check if factor exists and belongs to user
    const factor = await pool.query(
      `SELECT id FROM molam_mfa_factors WHERE id = $1 AND user_id = $2`,
      [factorId, userId]
    );

    if (factor.rows.length === 0) {
      return res.status(404).json({ error: 'Factor not found' });
    }

    // Soft delete (set is_active = false)
    await pool.query(
      `UPDATE molam_mfa_factors SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [factorId]
    );

    // Log removal
    await pool.query(
      `INSERT INTO molam_mfa_events (id, user_id, event_type, factor_id, success, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), userId, 'factor_removed', factorId, true, JSON.stringify({})]
    );

    return res.json({ success: true, message: 'Factor removed' });
  } catch (err) {
    console.error('Remove factor error:', err);
    return res.status(500).json({ error: 'Failed to remove factor' });
  }
});

/**
 * GET /api/mfa/policy/:scope
 * Get MFA policy for scope
 */
router.get('/policy/:scope', async (req, res) => {
  const scope = req.params.scope || 'default';

  try {
    const policy = await pool.query(
      `SELECT scope, rule, updated_at FROM molam_mfa_policies WHERE scope = $1`,
      [scope]
    );

    if (policy.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    return res.json(policy.rows[0]);
  } catch (err) {
    console.error('Get policy error:', err);
    return res.status(500).json({ error: 'Failed to get policy' });
  }
});

export default router;
