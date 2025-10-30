// src/routes/pin.ts
import { Router } from 'express';
import { z } from 'zod';
import { normalizeIdentity } from '../utils/phone.js';
import { pool } from '../services/db.js';
import { issueOTP, verifyOTP, markVerified, markConsumed } from '../services/otp.service.js';
import { sms, email } from '../services/notifications.service.js';
import { hashSecret } from '../utils/crypto.js';
import { invalidateUserSessions } from '../services/sessions.service.js';
import { rateLimitPinForgot } from '../middlewares/rateLimit.js';
import { env } from '../config/env.js';
import { metrics } from '../services/metrics.js';
import { publishEvent } from '../services/events.js';

export const pinRouter = Router();

/**
 * POST /ussd/pin/reset/start
 * Initiate PIN reset (app/web)
 */
pinRouter.post('/ussd/pin/reset/start', rateLimitPinForgot, async (req, res, next) => {
  try {
    const { identity } = z.object({ identity: z.string() }).parse(req.body);

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

    // Issue OTP
    const { otp, expires } = await issueOTP(
      user.id,
      id.type === 'email' ? 'email' : 'sms',
      'ussd_pin',
      country
    );

    // Send notification
    if (id.type === 'email') {
      await email.send(user.email, otp, 'ussd_pin', lang);
    } else {
      await sms.send(user.phone_e164, otp, lang, country);
    }

    // Metrics
    metrics.ussdPinResetRequests.inc({ country: country || 'unknown', channel: id.type });

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs
       (target_user_id, action, module, metadata, country_code, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'PIN_RESET_REQUEST',
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
 * POST /ussd/pin/reset/verify
 * Verify OTP for PIN reset
 */
pinRouter.post('/ussd/pin/reset/verify', async (req, res, next) => {
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
       WHERE user_id = $1 AND kind = 'ussd_pin' AND status = 'pending'
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

    return res.json({ status: 'verified' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /ussd/pin/reset/confirm
 * Set new PIN (app/web)
 */
pinRouter.post('/ussd/pin/reset/confirm', async (req, res, next) => {
  try {
    const { identity, new_pin } = z.object({
      identity: z.string(),
      new_pin: z.string().regex(/^\d{4,6}$/),
    }).parse(req.body);

    const id = normalizeIdentity(identity);

    const userQuery = id.type === 'email'
      ? 'SELECT id, country_code FROM molam_users WHERE email = $1'
      : 'SELECT id, country_code FROM molam_users WHERE phone_e164 = $1';

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

    // Metrics
    metrics.ussdPinResetSuccess.inc({ country: user.country_code || 'unknown' });

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs (target_user_id, action, module, country_code)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'PIN_RESET_CONFIRMED', 'id', user.country_code]
    );

    // Publish event
    await publishEvent({
      event: 'id.ussd.pin.reset.completed',
      user_id: user.id,
      country_code: user.country_code,
      channel: 'app',
      timestamp: new Date().toISOString(),
    });

    return res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});
