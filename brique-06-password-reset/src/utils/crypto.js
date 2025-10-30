import argon2 from 'argon2';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Hash secret with Argon2id + pepper
 * @param {string} value - Value to hash (password, PIN, OTP)
 * @returns {Promise<string>} - Argon2id hash
 */
export async function hashSecret(value) {
  const peppered = value + env.PEPPER;
  return argon2.hash(peppered, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MB
    timeCost: 2,
    parallelism: 1
  });
}

/**
 * Verify secret against hash
 * @param {string} hash - Stored hash
 * @param {string} value - Value to verify
 * @returns {Promise<boolean>} - True if valid
 */
export async function verifySecret(hash, value) {
  try {
    const peppered = value + env.PEPPER;
    return await argon2.verify(hash, peppered);
  } catch (err) {
    return false;
  }
}

/**
 * Generate random numeric OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Numeric OTP code
 */
export function randomNumeric(length = 6) {
  const buf = crypto.randomBytes(length);
  // Map bytes to digits 0-9
  return Array.from(buf)
    .slice(0, length)
    .map(b => (b % 10).toString())
    .join('');
}

/**
 * Generate correlation ID for audit trail
 * @returns {string} - UUID v4
 */
export function generateCorrelationId() {
  return crypto.randomUUID();
}

/**
 * Generate secure random token
 * @param {number} bytes - Number of bytes (default: 32)
 * @returns {string} - Hex encoded token
 */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
