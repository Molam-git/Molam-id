import crypto from 'crypto';
import argon2 from 'argon2';

/**
 * Hash OTP code with Argon2id
 * @param {string} code - The OTP code to hash
 * @returns {Promise<Buffer>} - Hashed code
 */
export async function hashOTP(code) {
  const hash = await argon2.hash(code, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4
  });
  return Buffer.from(hash);
}

/**
 * Verify OTP code against hash
 * @param {Buffer} hash - The stored hash
 * @param {string} code - The code to verify
 * @returns {Promise<boolean>} - True if valid
 */
export async function verifyOTP(hash, code) {
  try {
    return await argon2.verify(hash.toString(), code);
  } catch (err) {
    return false;
  }
}

/**
 * Generate random numeric OTP code
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} - Numeric code
 */
export function generateNumericOTP(length = 6) {
  const digits = '0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    code += digits[randomBytes[i] % 10];
  }

  return code;
}

/**
 * Generate recovery codes
 * @param {number} count - Number of codes to generate (default: 10)
 * @returns {string[]} - Array of recovery codes
 */
export function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX-XXXX (12 alphanumeric characters)
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}-${part3}`);
  }
  return codes;
}

/**
 * Generate HMAC for TOTP verification
 * @param {string} secret - Base32 secret
 * @param {number} counter - Time counter
 * @param {string} algo - Hash algorithm (default: SHA1)
 * @returns {Buffer} - HMAC digest
 */
export function generateHMAC(secret, counter, algo = 'SHA1') {
  const hmac = crypto.createHmac(algo.toLowerCase(), Buffer.from(secret, 'base64'));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  hmac.update(counterBuffer);
  return hmac.digest();
}

/**
 * Generate random base32 secret for TOTP
 * @param {number} length - Length in bytes (default: 32)
 * @returns {string} - Base32 encoded secret
 */
export function generateTOTPSecret(length = 32) {
  const bytes = crypto.randomBytes(length);
  return bytes.toString('base64');
}

/**
 * Hash recovery code with SHA-256 for storage
 * @param {string} code - Recovery code
 * @returns {Buffer} - SHA-256 hash
 */
export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code).digest();
}
