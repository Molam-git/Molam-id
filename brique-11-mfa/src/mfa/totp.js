import { generateHMAC, generateTOTPSecret } from './crypto.js';

/**
 * Generate TOTP code (RFC6238)
 * @param {string} secret - Base64 encoded secret
 * @param {object} options - TOTP options
 * @param {number} options.step - Time step in seconds (default: 30)
 * @param {number} options.digits - Number of digits (default: 6)
 * @param {string} options.algo - Hash algorithm (default: SHA1)
 * @param {number} options.time - Custom time in seconds (default: now)
 * @returns {string} - TOTP code
 */
export function generateTOTP(secret, options = {}) {
  const step = options.step || 30;
  const digits = options.digits || 6;
  const algo = options.algo || 'SHA1';
  const time = options.time || Math.floor(Date.now() / 1000);

  const counter = Math.floor(time / step);
  const hmac = generateHMAC(secret, counter, algo);

  // Dynamic truncation (RFC4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  );

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify TOTP code with time window
 * @param {string} code - User-provided code
 * @param {string} secret - Base64 encoded secret
 * @param {object} options - TOTP options
 * @param {number} options.step - Time step in seconds (default: 30)
 * @param {number} options.digits - Number of digits (default: 6)
 * @param {string} options.algo - Hash algorithm (default: SHA1)
 * @param {number} options.window - Time window (±N steps, default: 1)
 * @returns {boolean} - True if valid
 */
export function verifyTOTP(code, secret, options = {}) {
  const window = options.window || 1;
  const time = Math.floor(Date.now() / 1000);

  // Check current time and ±window steps
  for (let i = -window; i <= window; i++) {
    const testTime = time + (i * (options.step || 30));
    const expectedCode = generateTOTP(secret, { ...options, time: testTime });

    if (code === expectedCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generate TOTP URI for QR code (otpauth://)
 * @param {string} secret - Base64 encoded secret
 * @param {string} accountName - User identifier (email, phone)
 * @param {string} issuer - Service name (default: Molam-ID)
 * @param {object} options - TOTP options
 * @returns {string} - otpauth:// URI
 */
export function generateTOTPUri(secret, accountName, issuer = 'Molam-ID', options = {}) {
  const step = options.step || 30;
  const digits = options.digits || 6;
  const algo = (options.algo || 'SHA1').toUpperCase();

  const params = new URLSearchParams({
    secret: secret,
    issuer: issuer,
    algorithm: algo,
    digits: digits.toString(),
    period: step.toString()
  });

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params.toString()}`;
}

/**
 * Create new TOTP factor
 * @param {string} accountName - User identifier
 * @param {object} options - TOTP options
 * @returns {object} - { secret, uri, qr_data }
 */
export function createTOTPFactor(accountName, options = {}) {
  const secret = generateTOTPSecret();
  const uri = generateTOTPUri(secret, accountName, options.issuer, options);

  return {
    secret,
    uri,
    qr_data: uri // Can be encoded as QR code on frontend
  };
}
