import { pool } from './db.js';
import { randomNumeric, hashSecret } from '../utils/crypto.js';
import { env } from '../config/env.js';

/**
 * Issue OTP for password or PIN reset
 * @param {string} userId - User ID
 * @param {string} channel - 'email' | 'sms' | 'ussd'
 * @param {string} kind - 'password' | 'ussd_pin'
 * @param {string} country - Country code (ISO 3166-1 alpha-2)
 * @returns {Promise<object>} - { requestId, otp, expires }
 */
export async function issueOTP(userId, channel, kind, country) {
  const otp = randomNumeric(env.OTP_LENGTH);
  const otpHash = await hashSecret(otp);
  const expires = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  const { rows } = await pool.query(
    `INSERT INTO molam_reset_requests (user_id, channel, kind, otp_hash, otp_expires_at, country_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, channel, kind, otpHash, expires, country || null]
  );

  return {
    requestId: rows[0].id,
    otp,
    expires
  };
}

/**
 * Verify OTP
 * @param {string} requestId - Reset request ID
 * @param {string} otp - OTP code to verify
 * @returns {Promise<boolean>} - True if valid
 */
export async function verifyOTP(requestId, otp) {
  const { verifySecret } = await import('../utils/crypto.js');

  const { rows } = await pool.query(
    `SELECT otp_hash, otp_expires_at, attempts, max_attempts, status
     FROM molam_reset_requests
     WHERE id = $1`,
    [requestId]
  );

  if (rows.length === 0) return false;

  const request = rows[0];

  // Check status
  if (request.status !== 'pending') return false;

  // Check expiry
  if (new Date(request.otp_expires_at) < new Date()) {
    await pool.query(`UPDATE molam_reset_requests SET status = 'expired' WHERE id = $1`, [requestId]);
    return false;
  }

  // Check max attempts
  if (request.attempts >= request.max_attempts) {
    await pool.query(`UPDATE molam_reset_requests SET status = 'blocked' WHERE id = $1`, [requestId]);
    return false;
  }

  // Verify OTP
  const valid = await verifySecret(request.otp_hash, otp);

  // Increment attempts
  await pool.query(`UPDATE molam_reset_requests SET attempts = attempts + 1 WHERE id = $1`, [requestId]);

  return valid;
}

/**
 * Mark request as verified
 * @param {string} requestId - Reset request ID
 */
export async function markVerified(requestId) {
  await pool.query(
    `UPDATE molam_reset_requests SET status = 'verified', updated_at = NOW() WHERE id = $1`,
    [requestId]
  );
}

/**
 * Mark request as consumed
 * @param {string} requestId - Reset request ID
 */
export async function markConsumed(requestId) {
  await pool.query(
    `UPDATE molam_reset_requests SET status = 'consumed', updated_at = NOW() WHERE id = $1`,
    [requestId]
  );
}
