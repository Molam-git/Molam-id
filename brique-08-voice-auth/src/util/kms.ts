// KMS/Encryption utilities
// Envelope encryption with AES-256-GCM
import crypto from "crypto";
import { config } from "../config";

export interface EncryptedEnvelope {
  iv: Buffer;
  ct: Buffer;
  tag: Buffer;
}

/**
 * Encrypt data using envelope encryption (AES-256-GCM)
 */
export function encryptEnvelope(plaintext: Buffer): EncryptedEnvelope {
  const key = crypto.createHash("sha256").update(config.dataEncKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, ct, tag };
}

/**
 * Decrypt envelope-encrypted data
 */
export function decryptEnvelope(iv: Buffer, ct: Buffer, tag: Buffer): Buffer {
  const key = crypto.createHash("sha256").update(config.dataEncKey).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Decrypt from combined buffer format: [iv(12) | tag(16) | ciphertext]
 */
export function decryptEnvelopeCombined(combined: Buffer): Buffer {
  const iv = combined.subarray(0, 12);
  const tag = combined.subarray(12, 28);
  const ct = combined.subarray(28);
  return decryptEnvelope(iv, ct, tag);
}

/**
 * Encrypt and combine into single buffer: [iv | tag | ct]
 */
export function encryptEnvelopeCombined(plaintext: Buffer): Buffer {
  const { iv, ct, tag } = encryptEnvelope(plaintext);
  return Buffer.concat([iv, tag, ct]);
}
