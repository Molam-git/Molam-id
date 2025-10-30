// src/routes/password.ts
import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { normalizeIdentity } from '../utils/phone.js';
import { issueOTP, verifyOTP, markVerified, markConsumed } from '../services/otp.service.js';
import { pool } from '../services/db.js';
import { env } from '../config/env.js';
import { sms, email } from '../services/notifications.service.js';
import { invalidateUserSessions } from '../services/sessions.service.js';
import { hashSecret } from '../utils/crypto.js';
import { rateLimitPasswordForgot } from '../middlewares/rateLimit.js';
import { metrics } from '../services/metrics.js';
import { publishEvent } from '../services/events.js';

export const passwordRouter = Router();

/**
 * POST /password/forgot
 * Initiate password reset (send OTP)
 */
passwordRouter.post('/password/forgot', rateLimitPasswordForgot, async (req, res, next) => {
  try {
    const { identity } = z.object({ identity: z.string().min(3) }).parse(req.body);

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
    const { otp, expires } = await issueOTP(
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

    // Metrics
    metrics.passwordResetRequests.inc({ country: country || 'unknown', channel: id.type });

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs
       (target_user_id, action, module, metadata, country_code, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'PASSWORD_RESET_REQUEST',
        'id',
        JSON.stringify({ channel: id.type }),
        country,
        req.ip,
        req.get('user-agent'),
      ]
    );

    return res.status(202).json({
      status: 'accepted',
      expires_at: expires.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /password/verify
 * Verify OTP code
 */
passwordRouter.post('/password/verify', async (req, res, next) => {
  try {
    const { identity, otp } = z.object({
      identity: z.string(),
      otp: z.string().min(4).max(8),
    }).parse(req.body);

    const id = normalizeIdentity(identity);

    const userQuery = id.type === 'email'
      ? 'SELECT id FROM molam_users WHERE email = $1'
      : 'SELECT id FROM molam_users WHERE phone_e164 = $1';

    const { rows: users } = await pool.query(userQuery, [id.value]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];

    // Find pending request
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

    // Increment attempts
    await pool.query(
      `UPDATE molam_reset_requests SET attempts = attempts + 1, updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    if (!valid) {
      return res.status(401).json({ error: 'OTP_INVALID' });
    }

    // Mark as verified
    await markVerified(requestId);

    // Generate reset token (JWT)
    const resetToken = jwt.sign(
      { uid: user.id, kind: 'password', rrid: requestId },
      env.JWT_RESET_SECRET,
      { expiresIn: env.JWT_RESET_TTL_S }
    );

    return res.json({ reset_token: resetToken });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /password/confirm
 * Set new password
 */
passwordRouter.post('/password/confirm', async (req, res, next) => {
  try {
    const { reset_token, new_password } = z.object({
      reset_token: z.string(),
      new_password: z.string().min(8),
    }).parse(req.body);

    // Verify JWT
    let payload: any;
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

    // Get user country for metrics
    const { rows: users } = await pool.query(
      'SELECT country_code FROM molam_users WHERE id = $1',
      [payload.uid]
    );
    const country = users[0]?.country_code;

    // Update password
    await pool.query(
      `UPDATE molam_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, payload.uid]
    );

    // Mark request as consumed
    await markConsumed(payload.rrid);

    // Invalidate all sessions
    await invalidateUserSessions(payload.uid);

    // Metrics
    metrics.passwordResetSuccess.inc({ country: country || 'unknown' });

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs (target_user_id, action, module, country_code)
       VALUES ($1, $2, $3, $4)`,
      [payload.uid, 'PASSWORD_RESET_CONFIRMED', 'id', country]
    );

    // Publish event
    await publishEvent({
      event: 'id.password.reset.completed',
      user_id: payload.uid,
      country_code: country,
      timestamp: new Date().toISOString(),
    });

    return res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});
