// src/services/otp.service.ts
import { pool } from './db.js';
import { randomNumeric, hashSecret, verifySecret } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { metrics } from './metrics.js';

export interface OTPResult {
  requestId: string;
  otp: string;
  expires: Date;
}

/**
 * Issue a new OTP for password or PIN reset
 */
export async function issueOTP(
  userId: string,
  channel: 'email' | 'sms' | 'ussd',
  kind: 'password' | 'ussd_pin',
  country?: string
): Promise<OTPResult> {
  const otp = randomNumeric(env.OTP_LENGTH);
  const otpHash = await hashSecret(otp);
  const expires = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  const { rows } = await pool.query(
    `INSERT INTO molam_reset_requests
     (user_id, channel, kind, otp_hash, otp_expires_at, max_attempts, country_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, channel, kind, otpHash, expires, env.MAX_ATTEMPTS, country || null]
  );

  // Metrics
  metrics.otpGenerated.inc({ kind, country: country || 'unknown' });

  return {
    requestId: rows[0].id,
    otp,
    expires,
  };
}

/**
 * Verify OTP code
 */
export async function verifyOTP(requestId: string, otpInput: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT otp_hash, otp_expires_at, attempts, max_attempts, status, kind, country_code
     FROM molam_reset_requests
     WHERE id = $1`,
    [requestId]
  );

  if (rows.length === 0) {
    metrics.otpFailures.inc({ kind: 'unknown', country: 'unknown', reason: 'not_found' });
    return false;
  }

  const req = rows[0];

  // Check if expired
  if (new Date(req.otp_expires_at).getTime() < Date.now()) {
    metrics.otpFailures.inc({ kind: req.kind, country: req.country_code || 'unknown', reason: 'expired' });
    await pool.query(`UPDATE molam_reset_requests SET status = 'expired' WHERE id = $1`, [requestId]);
    return false;
  }

  // Check if max attempts reached
  if (req.attempts >= req.max_attempts) {
    metrics.otpFailures.inc({ kind: req.kind, country: req.country_code || 'unknown', reason: 'max_attempts' });
    await pool.query(`UPDATE molam_reset_requests SET status = 'blocked' WHERE id = $1`, [requestId]);
    return false;
  }

  // Check if already consumed/blocked
  if (req.status !== 'pending' && req.status !== 'verified') {
    metrics.otpFailures.inc({ kind: req.kind, country: req.country_code || 'unknown', reason: 'invalid_status' });
    return false;
  }

  // Verify hash
  const valid = await verifySecret(req.otp_hash, otpInput);

  if (!valid) {
    metrics.otpFailures.inc({ kind: req.kind, country: req.country_code || 'unknown', reason: 'invalid' });
  }

  return valid;
}

/**
 * Mark request as verified
 */
export async function markVerified(requestId: string): Promise<void> {
  await pool.query(
    `UPDATE molam_reset_requests SET status = 'verified', updated_at = NOW() WHERE id = $1`,
    [requestId]
  );
}

/**
 * Mark request as consumed (completed)
 */
export async function markConsumed(requestId: string): Promise<void> {
  await pool.query(
    `UPDATE molam_reset_requests SET status = 'consumed', updated_at = NOW() WHERE id = $1`,
    [requestId]
  );
}
