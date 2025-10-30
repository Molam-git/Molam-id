// src/routes/ussd.ts
import { Router, Request, Response } from 'express';
import { detectCountry } from '../utils/phone.js';
import { pool } from '../services/db.js';
import { t } from '../utils/i18n.js';
import { issueOTP, verifyOTP, markVerified } from '../services/otp.service.js';
import { sms } from '../services/notifications.service.js';
import { hashSecret } from '../utils/crypto.js';
import { invalidateUserSessions } from '../services/sessions.service.js';
import { env } from '../config/env.js';
import { metrics } from '../services/metrics.js';
import { publishEvent } from '../services/events.js';

export const ussdRouter = Router();

/**
 * POST /ussd
 * USSD Gateway Webhook
 *
 * The gateway provides:
 * - msisdn: caller E.164 number
 * - mccmnc: operator code (for country detection)
 * - text: user input chain (e.g., "" or "1" or "99*123456")
 * - short_code: e.g., "*131#", "*131*99#"
 */
ussdRouter.post('/ussd', async (req: Request, res: Response) => {
  try {
    const { msisdn, mccmnc, text, short_code } = req.body;

    if (!msisdn || !short_code) {
      return res.json({ response: 'END Invalid request.' });
    }

    // Detect country
    const country = detectCountry(mccmnc, msisdn);

    // Find user
    const { rows: users } = await pool.query(
      `SELECT id, language, country_code FROM molam_users WHERE phone_e164 = $1`,
      [msisdn]
    );

    const user = users[0];
    const lang = user?.language || env.DEFAULT_LANG;

    // Metrics
    metrics.ussdRequests.inc({ short_code, country: country || 'unknown' });

    // Route by short code
    switch (short_code) {
      case '*131#':
        return handleMainMenu(res, lang);

      case '*131*1#':
        return handleBalance(res, user, lang);

      case '*131*2#':
        return handleTopup(res, lang);

      case '*131*3#':
        return handleTransfer(res, lang);

      case '*131*99#':
        return await handlePinResetFlow(res, msisdn, user, lang, text, country);

      default:
        return res.json({ response: `END ${t(lang, 'USSD_UNKNOWN_CODE')}` });
    }
  } catch (err) {
    console.error('USSD webhook error:', err);
    return res.json({ response: 'END Service temporarily unavailable.' });
  }
});

/**
 * Main menu (*131#)
 */
function handleMainMenu(res: Response, lang: string) {
  return res.json({ response: `CON ${t(lang, 'USSD_MENU')}` });
}

/**
 * Balance check (*131*1#)
 */
function handleBalance(res: Response, user: any, lang: string) {
  if (!user) {
    return res.json({ response: `END ${t(lang, 'USSD_USER_NOT_FOUND')}` });
  }

  // TODO: Call wallet read API with authz-by-channel='ussd'
  // For now, redirect to app
  return res.json({ response: `END ${t(lang, 'USSD_BALANCE')}` });
}

/**
 * Top-up (*131*2#)
 */
function handleTopup(res: Response, lang: string) {
  return res.json({ response: `END ${t(lang, 'USSD_TOPUP')}` });
}

/**
 * Transfer (*131*3#)
 */
function handleTransfer(res: Response, lang: string) {
  return res.json({ response: `END ${t(lang, 'USSD_TRANSFER')}` });
}

/**
 * PIN reset flow (*131*99#)
 *
 * Flow states (based on text input):
 * - Step 0 (text=""): Issue OTP via SMS, prompt for OTP
 * - Step 1 (text="123456"): Verify OTP, prompt for new PIN
 * - Step 2 (text="123456*1234"): Prompt to repeat PIN
 * - Step 3 (text="123456*1234*1234"): Verify PIN match, save, done
 */
async function handlePinResetFlow(
  res: Response,
  msisdn: string,
  user: any,
  lang: string,
  text: string,
  country?: string
): Promise<Response> {
  if (!user) {
    return res.json({ response: `END ${t(lang, 'USSD_USER_NOT_FOUND')}` });
  }

  const parts = (text || '').split('*').filter(Boolean);

  // Step 0: Issue OTP
  if (parts.length === 0) {
    // Issue OTP via SMS
    const { otp } = await issueOTP(user.id, 'ussd', 'ussd_pin', country);

    // Send OTP via SMS (NOT displayed in USSD for security)
    await sms.send(msisdn, otp, lang, country);

    // Metrics
    metrics.ussdPinResetRequests.inc({ country: country || 'unknown', channel: 'ussd' });

    // Audit
    await pool.query(
      `INSERT INTO molam_audit_logs
       (target_user_id, action, module, metadata, country_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'PIN_RESET_REQUEST', 'id', JSON.stringify({ channel: 'ussd' }), country]
    );

    return res.json({ response: `CON ${t(lang, 'USSD_PIN_RESET_PROMPT')}` });
  }

  // Step 1: Verify OTP
  if (parts.length === 1) {
    const otpInput = parts[0];

    // Find pending request
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

    const requestId = requests[0].id;

    // Verify OTP
    const valid = await verifyOTP(requestId, otpInput);

    // Increment attempts
    await pool.query(
      `UPDATE molam_reset_requests SET attempts = attempts + 1, updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    if (!valid) {
      return res.json({ response: `END ${t(lang, 'USSD_CODE_INVALID')}` });
    }

    // Mark as verified
    await markVerified(requestId);

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

    // Validate PIN format
    if (!/^\d{4,6}$/.test(pin1) || pin1 !== pin2) {
      return res.json({ response: `END ${t(lang, 'USSD_PIN_MISMATCH')}` });
    }

    // Hash PIN
    const pinHash = await hashSecret(pin1);

    // Update PIN
    await pool.query(
      `UPDATE molam_users SET ussd_pin_hash = $1, updated_at = NOW() WHERE id = $2`,
      [pinHash, user.id]
    );

    // Invalidate USSD sessions
    await invalidateUserSessions(user.id, 'ussd');

    // Metrics
    metrics.ussdPinResetSuccess.inc({ country: country || 'unknown' });

    // Audit
    await pool.query(
      `INSERT INTO molam_audit_logs
       (target_user_id, action, module, metadata, country_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'USSD_PIN_RESET', 'id', JSON.stringify({ channel: 'ussd' }), country]
    );

    // Publish event
    await publishEvent({
      event: 'id.ussd.pin.reset.completed',
      user_id: user.id,
      country_code: country,
      channel: 'ussd',
      timestamp: new Date().toISOString(),
    });

    return res.json({ response: `END ${t(lang, 'USSD_SUCCESS')}` });
  }

  return res.json({ response: `END ${t(lang, 'USSD_UNKNOWN_CODE')}` });
}
