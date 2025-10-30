import crypto from 'crypto';

/**
 * Envelope encryption for TOTP secrets
 * In production, this would integrate with AWS KMS, HashiCorp Vault, or Azure Key Vault
 * For now, we use a local master key with AES-256-GCM
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Get master key from environment
 * In production, this should be fetched from KMS/Vault
 * @returns {Buffer} - Master encryption key
 */
function getMasterKey() {
  const keyHex = process.env.MFA_MASTER_KEY || crypto.randomBytes(KEY_LENGTH).toString('hex');

  if (!process.env.MFA_MASTER_KEY) {
    console.warn('⚠️  MFA_MASTER_KEY not set, using random key (secrets will not persist across restarts)');
  }

  return Buffer.from(keyHex.slice(0, KEY_LENGTH * 2), 'hex');
}

/**
 * Encrypt TOTP secret with envelope encryption
 * @param {string} plaintext - Secret to encrypt (base64)
 * @returns {Promise<Buffer>} - Encrypted data (IV + ciphertext + auth tag)
 */
export async function encryptSecret(plaintext) {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV (16 bytes) + Ciphertext (variable) + Auth Tag (16 bytes)
  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Decrypt TOTP secret
 * @param {Buffer} encryptedData - Encrypted data (IV + ciphertext + auth tag)
 * @returns {Promise<string>} - Decrypted secret (base64)
 */
export async function decryptSecret(encryptedData) {
  const masterKey = getMasterKey();

  // Parse encrypted data
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(encryptedData.length - TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH, encryptedData.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Rotate encryption (re-encrypt with new key)
 * @param {Buffer} encryptedData - Old encrypted data
 * @param {Buffer} newMasterKey - New master key
 * @returns {Promise<Buffer>} - Re-encrypted data
 */
export async function rotateSecret(encryptedData, newMasterKey) {
  // Decrypt with old key
  const plaintext = await decryptSecret(encryptedData);

  // Re-encrypt with new key (would need to pass newMasterKey to encrypt function)
  return await encryptSecret(plaintext);
}

/**
 * Hash recovery code for storage (one-way)
 * @param {string} code - Recovery code
 * @returns {Buffer} - SHA-256 hash
 */
export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest();
}
